import * as THREE from "three";
import gsap from "gsap";

export default class MoveManager {
  constructor(scene, camera, squares, onPlayerChange) {
    this.scene = scene;
    this.camera = camera;
    this.squares = squares;
    this.player = "White";
    this.onPlayerChange = onPlayerChange;
    this.selectedPawn = null;
    this.selectedPawnSquare = null;
    this.selectedPawnSquareX = null;
    this.selectedPawnSquareY = null;
    this.canMove = true;
    this.hoveredObject = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener("click", (event) => this.onMouseClick(event));
    window.addEventListener("mousemove", (event) => this.onMouseMove(event));
  }

  onMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersections = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersections.length > 0) {
      const hoveredObject = intersections[0].object;

      if (this.selectedPawn === null && hoveredObject.isPawn) {
        if (
          this.hoveredObject !== hoveredObject &&
          this.isPawnPlayer(hoveredObject)
        ) {
          this.resetHover();
          this.hoveredObject = hoveredObject;

          gsap.killTweensOf(hoveredObject.material);
          gsap.to(hoveredObject.material, {
            opacity: 0.5,
            duration: 0.2,
          });
        }
      } else {
        this.resetHover();
      }
    } else {
      this.resetHover();
    }
  }

  resetHover() {
    if (this.hoveredObject) {
      gsap.killTweensOf(this.hoveredObject.material);
      gsap.to(this.hoveredObject.material, {
        opacity: 1,
        duration: 0.2,
      });

      this.hoveredObject = null;
    }
  }

  onMouseClick(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersections = this.raycaster.intersectObjects(
      this.scene.children,
      true
    );

    if (intersections.length > 0 && this.canMove) {
      const selectedObject = intersections[0].object;

      if (selectedObject.isPawn && this.isPawnPlayer(selectedObject)) {
        if (this.selectedPawn === selectedObject) {
          this.clearAvailableMovesHighlight();
          this.resetPawn();
          this.selectedPawn = null;
          this.selectedPawnSquare = null;
          return;
        }

        if (this.selectedPawn) {
          this.clearAvailableMovesHighlight();
          this.resetPawn();
        }

        this.setPawn(selectedObject);

        this.selectedPawn = selectedObject;
        const [pawnSquareY, pawnSquareX] = this.calculateSquarePosition(
          this.selectedPawn.onSquareId
        );
        this.selectedPawnSquareX = pawnSquareX;
        this.selectedPawnSquareY = pawnSquareY;
        this.selectedPawnSquare = this.squares[pawnSquareY][pawnSquareX];

        this.highlightAvailableMoves();
      } else if (selectedObject.isSquare) {
        if (this.selectedPawn === null || selectedObject.isOccupied) return;
        else {
          this.movePawn(selectedObject);
        }
      }
    }
  }

  highlightAvailableMoves() {
    const [type, availableMoves] = this.checkAvailableMoves(
      this.selectedPawn.onSquareId
    );
    availableMoves.forEach((square) => {
      gsap.to(square.material.color, {
        r: 0.2,
        g: 0.5,
        b: 0.2,
        duration: 0.2,
      });
    });
  }

  clearAvailableMovesHighlight() {
    for (let i = 0; i < this.squares.length; i++) {
      for (let j = 0; j < this.squares[i].length; j++) {
        const square = this.squares[i][j];
        gsap.to(square.material.color, {
          r: square.defaultColor.r,
          g: square.defaultColor.g,
          b: square.defaultColor.b,
          duration: 0.2,
        });
      }
    }
  }

  checkAvailableMoves() {
    const availableMoves = [];
    const availableCaptures = [];

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const square = this.squares[y][x];
        const [deltaX, deltaY] = this.calculateDelta(square);

        if (this.checkMove(square, deltaX, deltaY)) {
          if (deltaX === 2 && Math.abs(deltaY) === 2) {
            availableCaptures.push(square);
          } else if (!square.isOccupied) {
            availableMoves.push(square);
          }
        }
      }
    }

    return availableCaptures.length > 0
      ? ["c", availableCaptures]
      : ["m", availableMoves];
  }

  checkMove(square, deltaX, deltaY) {
    if (this.selectedPawn) {
      if (!this.selectedPawn.isQueen) {
        if (
          deltaX === 1 &&
          ((this.selectedPawn.isWhite && deltaY === -1) ||
            (!this.selectedPawn.isWhite && deltaY === 1))
        )
          return true;
        else if (deltaX === 2 && Math.abs(deltaY) === 2) {
          if (this.checkPawnCapture(square)) {
            return true;
          }
        } else return false;
      }
    } else return false;
  }

  checkPawnCapture(square) {
    const [targetY, targetX] = this.calculateSquarePosition(square.squareId);

    const middleSquareX = (this.selectedPawnSquareX + targetX) / 2;
    const middleSquareY = (this.selectedPawnSquareY + targetY) / 2;
    const middleSquare = this.squares[middleSquareY][middleSquareX];

    if (
      middleSquare.isOccupied &&
      middleSquare.occupyingPawn.isWhite !== this.selectedPawn.isWhite &&
      !square.isOccupied
    ) {
      return true;
    } else return false;
  }

  movePawn(selectedObject) {
    const [deltaX, deltaY] = this.calculateDelta(selectedObject);

    if (this.checkMove(selectedObject, deltaX, deltaY)) {
      if (deltaX === 2 && Math.abs(deltaY) === 2) {
        this.capturePawn(selectedObject);
      } else this.executeMove(selectedObject);
    }
  }

  capturePawn(targetSquare) {
    const [selectedPawnSquareY, selectedPawnSquareX] =
      this.calculateSquarePosition(this.selectedPawn.onSquareId);

    this.selectedPawnSquareX = selectedPawnSquareX;
    this.selectedPawnSquareY = selectedPawnSquareY;

    this.executeMove(targetSquare);

    const [targetY, targetX] = this.calculateSquarePosition(
      targetSquare.squareId
    );

    const middleSquareX = (this.selectedPawnSquareX + targetX) / 2;
    const middleSquareY = (this.selectedPawnSquareY + targetY) / 2;

    const middleSquare = this.squares[middleSquareY][middleSquareX];

    if (middleSquare.isOccupied) {
      gsap.to(middleSquare.occupyingPawn.material, {
        opacity: 0,
        duration: 0.25,
      });

      gsap.to(middleSquare.occupyingPawn.position, {
        y: -3,
        duration: 0.5,
        onComplete: () => {
          this.scene.remove(middleSquare.occupyingPawn);
          middleSquare.isOccupied = false;
          middleSquare.occupyingPawn = null;
        },
      });
    }
  }

  executeMove(selectedObject) {
    this.canMove = false;

    selectedObject.isOccupied = true;
    selectedObject.occupyingPawn = this.selectedPawn;

    this.selectedPawn.onSquareId = selectedObject.squareId;

    gsap.to(this.selectedPawn.position, {
      x: selectedObject.position.x,
      y: 4,
      z: selectedObject.position.z,
      duration: 0.5,
    });

    if (this.selectedPawnSquare) {
      this.selectedPawnSquare.isOccupied = false;
      this.selectedPawnSquare.occupyingPawn = null;
    }

    this.clearAvailableMovesHighlight();

    setTimeout(() => {
      this.selectedPawnSquare = null;
      this.canMove = true;

      this.resetPawn();
      this.selectedPawn = null;
      this.player = this.player === "White" ? "Black" : "White";
      this.onPlayerChange(this.player);
    }, 500);
  }

  calculateDelta(square) {
    const [targetY, targetX] = this.calculateSquarePosition(square.squareId);
    const [pawnSquareY, pawnSquareX] = this.calculateSquarePosition(
      this.selectedPawn.onSquareId
    );

    const deltaX = Math.abs(targetX - pawnSquareX);
    const deltaY = targetY - pawnSquareY;

    return [deltaX, deltaY];
  }

  setPawn(selectedObject) {
    this.resetHover();
    gsap.to(selectedObject.material.color, {
      r: 0.1,
      g: 1,
      b: 0.1,
      duration: 0.2,
    });
    gsap.to(selectedObject.position, { y: 4, duration: 0.5 });
  }

  resetPawn() {
    gsap.to(this.selectedPawn.material.color, {
      r: this.selectedPawn.basicColor.r,
      g: this.selectedPawn.basicColor.g,
      b: this.selectedPawn.basicColor.b,
      duration: 0.5,
    });
    gsap.to(this.selectedPawn.position, { y: 1.05, duration: 0.5 });
  }

  calculateSquarePosition(squareId) {
    const squareX = squareId % 8;
    const squareY = (squareId - squareX) / 8;

    return [squareY, squareX];
  }

  isPawnPlayer(pawn) {
    return (
      (this.player === "White" && pawn.isWhite) ||
      (this.player === "Black" && !pawn.isWhite)
    );
  }
}
