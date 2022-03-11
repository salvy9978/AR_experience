/*eslint-disable*/
function positionAmmoBody(body, p) {
  const transform = new Ammo.btTransform();

  body.getMotionState().getWorldTransform(transform);

  const positionVec = new Ammo.btVector3(p.x, p.y, p.z);

  transform.setOrigin(positionVec);
  body.getMotionState().setWorldTransform(transform);
  body.setCenterOfMassTransform(transform);
  body.activate();

  // Clean up
  Ammo.destroy(transform);
  Ammo.destroy(positionVec);
}

function createBox(scene, pos) {
  const box = document.createElement("a-box");
  box.setAttribute("id", "myBox");
  box.setAttribute("position", `${pos.x} ${pos.y + 1.6} ${pos.z}`);
  box.setAttribute("width", "0.2");
  box.setAttribute("height", "0.2");
  box.setAttribute("depth", "0.2");
  box.setAttribute("color", "#4CC3D9");
  box.setAttribute("rotation", "0 45 0");
  box.setAttribute("ammo-body", "type: dynamic; emitCollisionEvents: true;");
  box.setAttribute("ammo-shape", "type: box");
  box.setAttribute("ammo-restitution", ".5");
  box.setAttribute("collision-detection", {});

  scene.appendChild(box);

  box.addEventListener("body-loaded", () => {
    positionAmmoBody(box.body, box.object3D.position);
    const velocity = new Ammo.btVector3(0, 0, 0);
    box.body.setLinearVelocity(velocity);
    Ammo.destroy(velocity);
  });

  return box;
}

AFRAME.registerComponent("collision-detection", {
  init() {
    console.log("init");
    this.el.addEventListener("collidestart", function (e) {
      console.log(e);
    });
  }
});

AFRAME.registerComponent("user-body", {
  init: function () {},
  tick: (function () {
    const pos = new THREE.Vector3(0, 0, 0);
    return function () {
      if (!this.el) return;

      const scene = this.el.sceneEl;
      if (!(scene.is("vr-mode") || scene.is("ar-mode"))) return;

      const body = this.el.body;
      const frame = scene.frame;
      if (frame) {
        const refSpace = scene.renderer.xr.getReferenceSpace();

        const viewerPose = frame.getViewerPose(refSpace);
        if (viewerPose) {
          ["x", "y", "z"].forEach((axis) => {
            pos[axis] = viewerPose.transform.position[axis];
          });
          this.el.object3D.position.copy(pos);
          positionAmmoBody(body, pos);
          const velocity = new Ammo.btVector3(0, 0, 0);
          body.setLinearVelocity(velocity);
          Ammo.destroy(velocity);
        }
      }
    };
  })()
});

AFRAME.registerSystem("hit-test-system", {
  schema: {
    reticle: { type: "selector" },
    target: { type: "selector" }
  },
  init: function () {
    this.cubes = [];
    this.cubes.push(document.querySelector("a-box"));

    this.isPlaneInPlace = false;
    this.reticle = this.data.reticle;
    this.target = this.data.target;
    this.el.sceneEl.addEventListener("enter-vr", (e) => {
      const session = this.el.sceneEl.renderer.xr.getSession();
      this.el.sceneEl.renderer.xr.addEventListener(
        "sessionstart",
        async (ev) => {
          this.viewerSpace = await session.requestReferenceSpace("viewer");
          this.refSpace = this.el.sceneEl.renderer.xr.getReferenceSpace();
          this.xrHitTestSource = await session.requestHitTestSource({
            space: this.viewerSpace
          });
        }
      );
      session.addEventListener("select", (e) => {
        const pos = this.reticle.getAttribute("position");
        if (this.reticle.getAttribute("visible") && !this.isPlaneInPlace) {
          this.isPlaneInPlace = true;
          this.target.setAttribute("visible", "true");
          this.target.setAttribute("position", pos);
          //positionAmmoBody(this.target.body, pos);
        }

        if (this.isPlaneInPlace) {
          this.cubes.forEach((cube) =>
            cube.components["ammo-body"].syncToPhysics()
          );
          this.cubes.push(createBox(this.el.sceneEl, pos));
        }

        /*console.log(e);
        const box = document.querySelector("a-box");
        positionAmmoBody(box.body, new THREE.Vector3(0, 5, -5));
        const velocity = new Ammo.btVector3(0, 0, 0);
        box.body.setLinearVelocity(velocity);
        Ammo.destroy(velocity);
        */
      });
    });
  },

  tick: function (t) {
    this.reticle.setAttribute("visible", "false");
    const frame = this.el.sceneEl.frame;
    if (!frame) return;

    const viewerPose = this.el.sceneEl.renderer.xr.getCameraPose();
    if (!this.isPlaneInPlace && this.xrHitTestSource && viewerPose) {
      const hitTestResults = frame.getHitTestResults(this.xrHitTestSource);
      if (hitTestResults.length > 0) {
        const hitTestPose = hitTestResults[0].getPose(this.refSpace);
        ["x", "y", "z"].forEach((axis) => {
          this.reticle.object3D.position[axis] =
            hitTestPose.transform.position[axis];
        });
        this.reticle.object3D.quaternion.copy(
          hitTestPose.transform.orientation
        );
        this.reticle.setAttribute("visible", "true");
      }
    }
  }
});

AFRAME.registerComponent("ammo-restitution", {
  schema: { default: 0.5 },
  init() {
    const el = this.el;
    const restitution = this.data;
    el.addEventListener("body-loaded", function () {
      el.body.setRestitution(restitution);
    });
  }
});
