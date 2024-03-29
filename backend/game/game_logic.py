import os
import random
import copy

# general game settings
GAME_WIDTH = 100
GAME_HEIGHT = GAME_WIDTH / 16 * 9
MAX_SCORE = 5

# player pad settings
PAD_H = GAME_HEIGHT / 5
PAD_W = GAME_WIDTH / 100
PAD_SPEED = 1
PAD_OFFSET_X = PAD_W * 5
PAD_INITIAL_Y = GAME_HEIGHT / 2

# ball settings
BALL_SIZE = GAME_WIDTH / 100
BALL_SPEED = 1.5

class PongObject:
	def __init__(self):
		self.position = {"x": 0, "y": 0}
		self.obj_height = 0
		self.obj_width = 0

	def get_position(self):
		return self.position

	def get_x(self):
		return self.position["x"]

	def get_y(self):
		return self.position["y"]

	def get_x_bounds(self):
		return [self.position["x"] - self.obj_width, self.position["x"] + self.obj_width]

	def get_y_bounds(self):
		return [self.position["y"] - self.obj_height, self.position["y"] + self.obj_height]


class PongPaddle(PongObject):
	def __init__(self, x):
		self.obj_width = PAD_W / 2
		self.obj_height = PAD_H / 2
		self.INITIAL_POSITION = {"x": x, "y": PAD_INITIAL_Y}
		self.position = {"x": x, "y": PAD_INITIAL_Y}

	def	move_up(self):
		if self.position["y"] < GAME_HEIGHT - PAD_H / 2:
			self.position["y"] += PAD_SPEED

	def	move_down(self):
		if self.position["y"] > 0 + PAD_H / 2:
			self.position["y"] -= PAD_SPEED

	def move(self, direction):
		if direction == 1:
			self.move_up()
		elif direction == -1:
			self.move_down()

	def reset(self):
		self.position = copy.deepcopy(self.INITIAL_POSITION)


class PongBall(PongObject):
	def __init__(self):
		self.INITIAL_POSITION = {"x": GAME_WIDTH / 2, "y": GAME_HEIGHT / 2}
		self.position = {"x": GAME_WIDTH / 2, "y": GAME_HEIGHT / 2}
		self.direction = {"x": BALL_SPEED * random.choice([1, -1]), "y": 0}
		self.obj_width = BALL_SIZE / 2
		self.obj_height = BALL_SIZE / 2

	def reset(self, direction = 1):
		if direction == 2:
			direction = -1
		self.position = copy.deepcopy(self.INITIAL_POSITION)
		self.direction = {"x": BALL_SPEED * direction, "y": 0}

	def move(self):
		self.position["x"] += self.direction["x"]
		self.position["y"] += self.direction["y"]

	def get_direction(self):
		return self.direction

class PongGame:
	def __init__(self):
		self.score = {"p1": 0, "p2": 0}
		self.pad1 = PongPaddle(0 + PAD_OFFSET_X)
		self.pad2 = PongPaddle(GAME_WIDTH - PAD_OFFSET_X)
		self.ball = PongBall()
		self.finish = False

	def check_goal(self):
		if self.ball.get_x() > GAME_WIDTH + 20:
			self.score["p1"] += 1
			if self.score["p1"] == 5:
				self.finish = True
			return 1
		elif self.ball.get_x() < -20:
			self.score["p2"] += 1
			if self.score["p2"] == 5:
				self.finish = True
			return 2
		return 0

	def calculate_frame(self):
		goal = self.check_goal()
		if goal != 0:
			self.pad1.reset()
			self.pad2.reset()
			self.ball.reset(goal)
		self.ball_board_collision()
		self.ball_pad_collision(self.pad1)
		self.ball_pad_collision(self.pad2)
		self.ball.move()
		return goal

	def ball_board_collision(self):
		ball_bounds = self.ball.get_y_bounds()
		if ball_bounds[0] <= 0 or ball_bounds[1] >= GAME_HEIGHT:
			self.ball.direction["y"] *= -1

	def ball_pad_collision(self, pad: PongPaddle):
		ball_x_bounds = self.ball.get_x_bounds()
		ball_y_bounds = self.ball.get_y_bounds()

		pad_x_bounds = pad.get_x_bounds()
		pad_y_bounds = pad.get_y_bounds()

		if ball_x_bounds[0] <= pad_x_bounds[1] and ball_x_bounds[1] >= pad_x_bounds[0]:
			if ball_y_bounds[0] >= pad_y_bounds[0] and ball_y_bounds[1] <= pad_y_bounds[1]:
				self.ball.direction["x"] *= -1
				self.ball.direction["y"] = (self.ball.get_y() - pad.get_y()) / PAD_H

	def get_gamestate(self):
		return {
			"score": self.score,
			"pad1": self.pad1.get_position(),
			"pad2": self.pad2.get_position(),
			"ball": self.ball.get_position(),
			"ball_direction": self.ball.get_direction(),
		}

class AI:
	"""
	error represents the standard derivation of a normal distribution
	with a mean of 0 and a SD of 5, we get that 68% of the values are between
	-5 and 5.

	If our pad center is 0 and it is 10 units long, this means that we are hitting the ball
	right 68% of the time. The lower this value, higher chance of hitting the ball.

	With a SD of 7, the game is easy and with 5 its hard but playable
	"""
	def __init__(self, gamestate, error = 6):
		self.gamestate = gamestate
		self.error = error
		self.prediction = 0

	def predict_movement(self, pad_position) -> int:
		ball_pos = self.gamestate["ball"]
		ball_dir = self.gamestate["ball_direction"]

		if ball_dir["x"] <= 0.0:
			return 0

		slope = ball_dir["y"] / ball_dir["x"]
		final_pos = (pad_position["x"] - ball_pos["x"]) * slope + ball_pos["y"]

		error = random.normalvariate(0, self.error)

		if pad_position["y"] > final_pos + error:
			return -1
		if pad_position["y"] < final_pos + error:
			return 1
		return 0

	def predict_ball_position(self, pad_position):
		ball_pos = self.gamestate["ball"]
		ball_dir = self.gamestate["ball_direction"]

		if ball_dir["x"] <= 0.0: # if the ball is moving to the human player, move to the center?
			return 0

		slope = ball_dir["y"] / ball_dir["x"]
		final_pos = (pad_position["x"] - ball_pos["x"]) * slope + ball_pos["y"]

		error = random.uniform(self.error, -self.error)
		self.prediction = final_pos + error

	def decide_movement(self, pad_position) -> int:
		if self.prediction == 0.0 or abs(pad_position["y"] - self.prediction) < PAD_SPEED:
			return 0
		if pad_position["y"] < self.prediction:
			return 1
		if pad_position["y"] > self.prediction:
			return -1
		return 0