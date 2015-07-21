// adapted from https://github.com/shspage/paperjs-pressure-pdfout
module PenDrawing {
	let project: paper.Project;
	let kUndoLimit = 200;
	export let tools: NamedTool[];

	export function initialize(canvas: HTMLCanvasElement|string) {
		paper.setup(canvas);
		project = paper.project;
		tools = [new Brush(), new Pencil(), new Mover(), new Eraser()];
	}
	module UndoRedo {
		interface UndoItem {
			perform(is_undo:boolean) : void;
		}
		export class DeleteItem implements UndoItem {
			constructor(public itm: paper.Item[]) {}
			perform(is_undo) {
				for (let i of this.itm) if (i) i.visible = !i.visible;
			}
		}
		export class ModifyItem implements UndoItem {
			constructor(public itm: paper.Item, public itm2: paper.Point,public itm3: paper.Point) {}
			perform(is_undo) {
				this.itm.translate(is_undo ? this.itm2 : this.itm3);
			}
		}
		export class UndoRedoSystem {
			undoArray:UndoItem[] = [];
			redoArray:UndoItem[] = [];
			cleanUndo() {
				if (kUndoLimit > 0) {
					while (this.undoArray.length > kUndoLimit) this.undoArray.shift();
				}
			}
			undo() {
				if (this.undoArray.length > 0) {
					var arr = this.undoArray.pop();
					arr.perform(true);
					this.redoArray.push(arr);
				}
			}
			redo() {
				if (this.redoArray.length > 0) {
					var arr = this.redoArray.pop();
					arr.perform(false);
					this.undoArray.push(arr);
					this.cleanUndo();
				}
			}
			append(item:UndoItem) {
				this.undoArray.push(item);
				this.cleanUndo();
				this.clear(this.redoArray);
			}
			clearAll() {
				this.clear(this.undoArray);
				this.clear(this.redoArray);
			}
			
			clear(r:UndoItem[]) {
				var arr, typ, itm;
				while (r.length > 0) {
					arr = r.shift();
					typ = arr[0];
					itm = arr[1];
					if (typ == "dd") {
						if (itm) {
							for (var i = 0; i < itm.length; i++) {
								if (itm[i] && !itm[i].visible) {
									itm[i].remove();
									itm[i] = null;
								}
							}
						}
					} else {
						if (itm && !itm.visible) {
							itm.remove();
							itm = null;
						}
					}
				}
			}
		}
	}

	let undoRedo = new UndoRedo.UndoRedoSystem();
	(<any>window).undoRedo = undoRedo;

	function downloadSVG() {
		var out = paper.project.exportSVG({ asString: true });
		var a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([out], { type: "text/calendar" }));
		let date = new Date().toISOString().replace(/T/, " ").replace(/:/g, '.').substr(0, 19);
		(<any>a).download = `Drawing ${date}.svg`;
		a.click();
	}
	function clearCanvas(canvas_name) {
		paper.project.clear();
		undoRedo.clearAll();
	}

	let path: paper.Path;
	let myLastPoint: paper.Point;

	var opt = {
		stroke_color: "#000000",
		pressure_factor: 8,
		min_dist_squared: 4 * 4,
		target_item: null,
	};

	class NamedTool extends paper.Tool {
		constructor(public name: string, public desc: string) {
			super();
		}
		onKeyDown = (event: paper.KeyEvent) => {
			console.log(event);
			switch (event.key) {
				case "1": addToStrokeWidthValue(-1); break;
				case "2": addToStrokeWidthValue(1); break;
				case "z":
					if (event.modifiers.shift) {
						undoRedo.redo(); break;
					} else {
						undoRedo.undo(); break;
					}
				case "e":
					if (event.modifiers.shift) {
						clearLayer(); break;
					} else {
						changeTool(Eraser); break;
					}
				case "b": changeTool(Brush); break;
				case "m": changeTool(Mover); break;
				case "n": changeTool(Pencil); break;
				case "t": toggleDraft(); break;
			}
		}
	}

	class Brush extends NamedTool {
		constructor() { super("brush", "drag to draw") }
		maxDistance = 8;
		onMouseDown = (event: paper.ToolEvent) => {
			myLastPoint = event.point;
		}
		onMouseDrag = (event: paper.ToolEvent) => {
			if (event.point.getDistance(myLastPoint, true) > opt.min_dist_squared) {
				if (!path) {
					path = new paper.Path();
					path.fillColor = opt.stroke_color;
					path.closed = true;
					path.add(myLastPoint);
				} else {
					path.lastSegment.remove();
				}
				var pressure = WebRTCPen.info.pressure || 1.0;
				var v = event.point.subtract(myLastPoint).divide(2);
				var vp = v.normalize().multiply(pressure).multiply(opt.pressure_factor);
				vp.angle = vp.angle + 90;

				path.add(myLastPoint.add(v).add(vp));
				path.insert(0, myLastPoint.add(v).subtract(vp));

				path.add(event.point);
				path.smooth();

				myLastPoint = event.point;
			}
		}
		onMouseUp = (event: paper.ToolEvent) => {
			if (path) {
				if (path.segments.length < 2) {
					path.remove();
				} else {
					path.simplify();

					undoRedo.append(new UndoRedo.DeleteItem([path]));
				}
				path = null;
			}
		}
	}
	let _tmp = new Brush();
	class Pencil extends Brush {
		constructor() { super(); this.name = 'pencil'; }
		maxDistance = 8;
		onMouseDrag = (event: paper.ToolEvent) => {
			if (event.point.getDistance(myLastPoint, true) > opt.min_dist_squared) {
				if (!path) {
					path = new paper.Path();
					path.strokeColor = opt.stroke_color;
					path.closed = false;
					path.strokeWidth = opt.pressure_factor | 0;
					path.add(myLastPoint);
				}

				path.add(event.point);
				path.smooth();

				myLastPoint = event.point;
			}
		}
	}

	class Mover extends NamedTool {
		constructor() { super("mover", "drag to move") }
		maxDistance = 8;
		onMouseDown = (event: paper.ToolEvent) => {
			for (var i = 0; i < project.selectedItems.length; i++) {
				project.selectedItems[i].selected = false;
			}
			var result = project.hitTest(event.point);
			if (result && result.item) {
				result.item.selected = true;
				opt.target_item = result.item;
				myLastPoint = event.point;
			} else {
				opt.target_item = null;
			}
		}
		onMouseDrag = (event: paper.ToolEvent) => {
			if (opt.target_item) {
				opt.target_item.translate(event.point.subtract(myLastPoint));
				myLastPoint = event.point;
			}
		}
	}

	class Eraser extends NamedTool {
		constructor() { super("eraser", "CLICK to erase"); }
		maxDistance = 8;
		onMouseDown = (event: paper.ToolEvent) => {
			var result = project.hitTest(event.point);
			if (result && result.item) {
				result.item.visible = false;
				undoRedo.append(new UndoRedo.DeleteItem([result.item]));
			}
		}
		onMouseUp = (event: paper.ToolEvent) => {
			if (opt.target_item) {
				undoRedo.append(new UndoRedo.ModifyItem(opt.target_item, event.delta.multiply(-1), event.delta));
				opt.target_item.selected = false;
				opt.target_item = null;
			}
		}
	}
	function clearLayer() {
		var r = [];
		var cs = project.activeLayer.children;
		for (var i = 0; i < cs.length; i++) {
			if (cs[i].visible) {
				cs[i].visible = false;
				r.push(cs[i]);
			}
		}
		undoRedo.append(new UndoRedo.DeleteItem(r));
	}

	function toggleDraft() {
		if (project.layers.length < 2) {
			new paper.Layer();
		} else {
			var lay0 = project.layers[0];
			var lay1 = project.layers[1];
			lay0.moveAbove(lay1);
		}
		project.layers[0].opacity = 0.1;
		project.layers[1].opacity = 1.0;
		project.activeLayer = project.layers[1];
	}

	function changeTool(tool_class: typeof NamedTool) {
		let tool = tools.filter(tool => tool instanceof tool_class)[0];
		console.log(tool);
		document.getElementById('current_tool').innerHTML = tool.name;
		console.log(document.getElementById('current_tool'), tool.name);
		document.getElementById('tool_description').innerHTML = tool.desc;
		tool.activate();
	}

	function addToStrokeWidthValue(n) {
		if (opt.pressure_factor > 1 && opt.pressure_factor < 20) {
			opt.pressure_factor += n;
			document.getElementById('pressureFactorValue').innerHTML = "" + opt.pressure_factor;
		}
	}
}