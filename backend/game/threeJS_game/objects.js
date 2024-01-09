/* game logic */

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

const GAME_WIDTH = 100;
const GAME_HEIGHT = height_aspect_ratio(GAME_WIDTH);

const BALL_SPEED = 1;
const OBJECTS_Z = 0;

const PAD_H = GAME_HEIGHT / 5;
const PAD_W = GAME_WIDTH / 100;
const PAD_OFFSET_X = PAD_W * 5;
const PAD_INITIAL_Y = GAME_HEIGHT / 2;
const PAD_SPEED = 1;
const BALL_SIZE = GAME_WIDTH / 100;

const WALL_HEIGHT = 1;

const MAX_SCORE = 5;

const PLAYER_COLORS = {
	mindaro: 0xe2ef70,
	verdigris: 0x16bac5,
	jade: 0x00a878,
	golden_gate: 0xeb4511,
	pear: 0xd1d646,
	sunset: 0xffcb77,
	aqua: 0x42f2f7,
	persian_blue: 0x072ac8,
	emerald: 0x48bf84,
}

const COLORS = {
	white: 0xf8f9fa,
	purple: 0x7858dc,
	pink: 0xc3a5ec,
	space_cadet: 0x202646,
};

function half(value) {
	return value / 2.0;
}

function height_aspect_ratio(width) {
	return (width / 16) * 9;
}

function create_light(x, y, z, color, intensity) {
	let light = new THREE.PointLight(color, intensity);
	light.position.set(x, y, z);
	return light;
}

function random_choice(object) {
	var keys = Object.keys(object);
	var index = Math.floor(Math.random() * keys.length);
	return object[keys[index]];
}

class Paddle extends THREE.Mesh {
	constructor(x, color, index) {
		var capsule_length = PAD_H - PAD_W * 3;
		super(
			new THREE.CapsuleGeometry(PAD_W, capsule_length, 3, 10),
			new THREE.MeshStandardMaterial({color: color}),
		);
		this.index = index;
		this.position.set(x, PAD_INITIAL_Y, OBJECTS_Z);
		this.initial_pos = new THREE.Vector3(x, PAD_INITIAL_Y, OBJECTS_Z);
		this.rect_light = new THREE.RectAreaLight(color, 5, PAD_W, PAD_H);
		this.rect_light.position.set(half(PAD_W), 0, OBJECTS_Z + 1);
		this.rect_light.lookAt(0, 0, 0);
		if (index == 2)
			this.rotateZ(Math.PI);
		this.add(this.rect_light);
		this.color = color;
		this.width = PAD_W;
		this.height = PAD_H;
	}
	moveUp() {
		if (this.position.y < GAME_HEIGHT - half(PAD_H)) {
			this.position.y += PAD_SPEED;
		}
	}
	moveDown() {
		if (this.position.y > 0 + half(PAD_H)) {
			this.position.y -= PAD_SPEED;
		}
	}
	reset() {
		this.position.y = this.initial_pos.y;
	}
}

class Ball extends THREE.Mesh {
	constructor() {
		const radius = BALL_SIZE;
		super(
			new THREE.SphereGeometry(radius, 32, 16),
			new THREE.MeshPhongMaterial({ color: COLORS.pink, shininess: 100}),
		);
		this.radius = radius;
		this.position.set(half(GAME_WIDTH), half(GAME_HEIGHT), 1);
		this.direction = new THREE.Vector3(BALL_SPEED, 0, 0);
		this.light = create_light(0, 0, 0, COLORS.purple, 60);
		this.light.position.z = OBJECTS_Z;
		this.add(this.light);
		if (Date.now() % 2 == 0) {
			this.direction.x *= -1;
		}
	}
	move() {
		this.position.x += this.direction.x;
		this.position.y += this.direction.y;
	}
	reset(direction) {
		this.position.set(half(GAME_WIDTH), half(GAME_HEIGHT), 1);
		this.direction = new THREE.Vector3(BALL_SPEED * direction, 0, 0);
	}
	get lower_y() {
		return this.position.y - this.radius;
	}
	get upper_y() {
		return this.position.y + this.radius;
	}
	get left_x() {
		return this.position.x - this.radius;
	}
	get right_x() {
		return this.position.x + this.radius;
	}
}

class Wall extends THREE.Mesh {
	constructor(width, height) {
		super(
			new THREE.BoxGeometry(width, height, 1),
			new THREE.MeshStandardMaterial({ color: COLORS.purple }),
		);
		const rect_light = new THREE.RectAreaLight(COLORS.space_cadet, 50, width, height);
		rect_light.position.set(0, 0, 0.5);
		rect_light.lookAt(0, 0, 0);
		this.add(rect_light);
	}
}

class Board extends THREE.Group {
	constructor() {
		super();
		const floor = new THREE.Mesh(
			new THREE.PlaneGeometry(GAME_WIDTH, GAME_HEIGHT),
			new THREE.MeshStandardMaterial({
				color: COLORS.space_cadet,
				roughness: 0.1,
				metalness: 0.8,
			}),
		);
		floor.position.set(half(GAME_WIDTH), half(GAME_HEIGHT), 0);
		this.top_wall = new Wall(GAME_WIDTH, WALL_HEIGHT);
		this.top_wall.position.set(
			half(GAME_WIDTH),
			GAME_HEIGHT + WALL_HEIGHT,
			0,
		);
		this.bot_wall = new Wall(GAME_WIDTH, WALL_HEIGHT);
		this.bot_wall.position.set(half(GAME_WIDTH), 0 - WALL_HEIGHT, 0);
		this.midfield = new Wall(WALL_HEIGHT / 4, GAME_HEIGHT * 1.05);
		this.midfield.position.set(half(GAME_WIDTH), half(GAME_HEIGHT), -0.5);
		this.add(floor);
		this.add(new THREE.AmbientLight(COLORS.white, 0.4));
		this.add(this.top_wall);
		this.add(this.bot_wall);
		this.add(this.midfield);
	}
}

class Game extends THREE.Scene {
	constructor() {
		super();
		this.score = { p1: 0, p2: 0 };
		this.width = GAME_WIDTH;
		this.height = GAME_HEIGHT;
		this.board = new Board();
		this.pad1 = new Paddle(0 + PAD_OFFSET_X, random_choice(PLAYER_COLORS), 1);
		this.pad2 = new Paddle(GAME_WIDTH - PAD_OFFSET_X, random_choice(PLAYER_COLORS), 2);
		this.ball = new Ball();
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.toneMapping = THREE.ReinhardToneMapping;
		this.camera = new THREE.PerspectiveCamera(40, this.width / this.height);
		this.camera.position.set(half(this.width), half(this.height), 100);
		this.render();
	}
	render() {
		this.renderer.setSize(
			window.innerWidth,
			height_aspect_ratio(window.innerWidth),
		);
		this.add(this.ball);
		this.add(this.pad1);
		this.add(this.pad2);
		this.add(this.board);
		//this.add(new THREE.AmbientLight(0xcccccc, 0.3));
		this.update_score();
		this.renderer.domElement.setAttribute("id", "game");
		document.body.appendChild(this.renderer.domElement);
		// Neon style effect
		const renderScene = new RenderPass(this, this.camera);
		const bloomPass = new UnrealBloomPass(
			new THREE.Vector2(
				window.innerWidth,
				height_aspect_ratio(window.innerWidth),
			),
		);
		bloomPass.threshold = 0.1;
		bloomPass.strength = 0.1;
		bloomPass.radius = 0.1;

		const outputPass = new OutputPass();

		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(renderScene);
		this.composer.addPass(bloomPass);
		this.composer.addPass(outputPass);
		this.renderer.toneMappingExposure = 16;
	}
	update() {
		if (!this.check_game_end()) {
			var goal = this.check_goal();
			if (goal != 0)
			{
				this.reset_board(goal);
				this.update_score();
			}
			var pad_hit = this.check_pad_collisions();
			if (pad_hit != 0) this.calculate_ball_dir(pad_hit);
			if (this.check_board_collision()) this.ball.direction.y *= -1;
			this.ball.move();
		}
	}
	update_score() {
		if (this.score.p1 == MAX_SCORE - 1 && this.score.p2 == MAX_SCORE - 1)
		{
			document.getElementById("score").innerText = "MATCH POINT";
		}
		else {
			document.getElementById("score").innerText = `${this.score.p1}\u00A0\u00A0${this.score.p2}`;
		}
	}
	reset_board(direction) {
		this.ball.reset(direction);
		this.pad1.reset();
		this.pad2.reset();
	}
	check_goal() {
		if (this.ball.position.x > GAME_WIDTH) {
			this.score.p1 += 1;
			return 1;
		} else if (this.ball.position.x < 0) {
			this.score.p2 += 1;
			return -1;
		}
		return 0;
	}
	check_pad_collisions() {
		if (this.calculate_pad_hit(this.ball, this.pad1)) return -1;
		if (this.calculate_pad_hit(this.ball, this.pad2)) return 1;
		return 0;
	}
	calculate_pad_hit(ball, pad) {
		var hit = {
			x: ball.right_x - pad.position.x,
			y: ball.position.y - pad.position.y,
		};
		if (pad.index == 1) hit.x = ball.left_x - pad.position.x;
		if (
			hit.y <= half(PAD_H) &&
			hit.y >= half(-PAD_H) &&
			hit.x <= half(PAD_W) &&
			hit.x >= half(-PAD_W)
		)
			return true;
		return false;
	}
	check_board_collision() {
		if (this.ball.lower_y <= 0 || this.ball.upper_y >= GAME_HEIGHT)
			return true;
		return false;
	}
	calculate_ball_dir(pad_hit) {
		if (pad_hit == -1) {
			this.ball.direction.x *= -1;
			this.ball.direction.y =
				(this.ball.position.y - this.pad1.position.y) / PAD_H;
		}
		if (pad_hit == 1) {
			this.ball.direction.x *= -1;
			this.ball.direction.y =
				(this.ball.position.y - this.pad2.position.y) / PAD_H;
		}
	}
	check_game_end() {
		if (this.score.p1 >= MAX_SCORE || this.score.p2 >= MAX_SCORE) {
			console.log("Game ended");
			return true;
		}
		return false;
	}
}

export default Game;