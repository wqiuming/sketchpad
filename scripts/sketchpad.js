function Sketchpad(config) {

  // Warn the user if no DOM element was selected
  if (!config.hasOwnProperty('element')) {
    console.error('SKETCHPAD ERROR: No element selected');
    return;
  }

  this.element = config.element;

  // Width can be defined on the HTML or programatically
  this._width = config.width || $(this.element).attr('data-width') || 0;
  this._height = config.height || $(this.element).attr('data-height') || 0;

  // Pen attributes
  this.color = config.color || $(this.element).attr('data-color') || '#000000';
  this.penSize = config.penSize || $(this.element).attr('data-penSize') || 5;

  // ReadOnly sketchpads may not be modified
  this.readOnly = config.readOnly ||
                  $(this.element).attr('data-readOnly') ||
                  false;

  // Stroke control variables
  this.strokes = config.strokes || [];
  this._currentStroke = {
    color: null,
    size: null,
    lines: [],
  };

  // Undo History
  this.undoHistory = config.undoHistory || [];

  // Animation function calls
  this.animateIds = [];

  // Setup canvas sketching listeners
  this.reset();
}

//
// Private API
//

Sketchpad.prototype._cursorPosition = function(event) {
  return {
    x: event.pageX - this.canvas.offsetLeft,
    y: event.pageY - this.canvas.offsetTop,
  };
};

Sketchpad.prototype._cursorMove = function(event) {
  var currentPosition = this._cursorPosition(event);

  this._draw(this._lastPosition, currentPosition, this.color, this.penSize);
  this._currentStroke.lines.push({
    start: $.extend(true, {}, this._lastPosition),
    end: $.extend(true, {}, currentPosition),
  });

  this._lastPosition = currentPosition;
};

Sketchpad.prototype._draw = function(start, end, color, size) {
  this._stroke(start, end, color, size, 'source-over');
};

Sketchpad.prototype._erase = function(start, end, color, size) {
  this._stroke(start, end, color, size, 'destination-out');
};

Sketchpad.prototype._stroke = function(start, end, color, size, compositeOperation) {
  this.context.save();
  this.context.lineJoin = 'round';
  this.context.lineCap = 'round';
  this.context.strokeStyle = color;
  this.context.lineWidth = size;
  this.context.globalCompositeOperation = compositeOperation;
  this.context.beginPath();
  this.context.moveTo(start.x, start.y);
  this.context.lineTo(end.x, end.y);
  this.context.closePath();
  this.context.stroke();

  this.context.restore();
};

//
// Public API
//

Sketchpad.prototype.reset = function() {
  // Set attributes
  this.canvas = $(this.element)[0];
  this.canvas.width = this._width;
  this.canvas.height = this._height;
  this.context = this.canvas.getContext('2d');

  // Setup event listeners
  var sketching = false;
  var callback = this._cursorMove.bind(this);

  this.redraw(this.strokes);

  if (this.readOnly) {
    return;
  }

  this.canvas.addEventListener('mousedown', function(event) {
    this._lastPosition = this._cursorPosition(event);
    this._currentStroke.color = this.color;
    this._currentStroke.size = this.penSize;
    this._currentStroke.lines = [];
    sketching = true;
    this.canvas.addEventListener('mousemove', callback);
  }.bind(this));
  this.canvas.addEventListener('mouseout', function(event) {
    if (sketching) {
      this.strokes.push($.extend(true, {}, this._currentStroke));
      sketching = false;
    }
    this.canvas.removeEventListener('mousemove', callback);
  }.bind(this));
  this.canvas.addEventListener('mouseup', function(event) {
    if (sketching) {
      this.strokes.push($.extend(true, {}, this._currentStroke));
      sketching = false;
    }
    this.canvas.removeEventListener('mousemove', callback);
  }.bind(this));
};

Sketchpad.prototype.drawStroke = function(stroke) {
  for (var j = 0; j < stroke.lines.length; j++) {
    var line = stroke.lines[j];
    this._draw(line.start, line.end, stroke.color, stroke.size);
  }
};

Sketchpad.prototype.redraw = function(strokes) {
  for (var i = 0; i < strokes.length; i++) {
    this.drawStroke(strokes[i]);
  }
};

Sketchpad.prototype.toObject = function() {
  return {
    width: this.canvas.width,
    height: this.canvas.height,
    strokes: this.strokes,
    undoHistory: this.undoHistory,
  };
};

Sketchpad.prototype.toJSON = function() {
  return JSON.stringify(this.toObject());
};

Sketchpad.prototype.animate = function(ms, loop, loopDelay) {
  this.clear();
  var delay = ms;
  var callback = null;
  for (var i = 0; i < this.strokes.length; i++) {
    var stroke = this.strokes[i];
    for (var j = 0; j < stroke.lines.length; j++) {
      var line = stroke.lines[j];
      callback = this._draw.bind(this, line.start, line.end,
                                 stroke.color, stroke.size);
      this.animateIds.push(setTimeout(callback, delay));
      delay += ms;
    }
  }
  if (loop) {
    loopDelay = loopDelay || 0;
    callback = this.animate.bind(this, ms, loop, loopDelay);
    this.animateIds.push(setTimeout(callback, delay + loopDelay));
  }
};

Sketchpad.prototype.cancelAnimation = function() {
  for (var i = 0; i < this.animateIds.length; i++) {
    clearTimeout(this.animateIds[i]);
  }
};

Sketchpad.prototype.clear = function() {
  this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
};

Sketchpad.prototype.undo = function() {
  this.clear();
  var stroke = this.strokes.pop();
  if (stroke) {
    this.undoHistory.push(stroke);
    this.redraw(this.strokes);
  }
};

Sketchpad.prototype.redo = function() {
  var stroke = this.undoHistory.pop();
  if (stroke) {
    this.strokes.push(stroke);
    this.drawStroke(stroke);
  }
};
