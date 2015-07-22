// adapted from https://github.com/shspage/paperjs-pressure-pdfout
module PenDrawing {
	let project: paper.Project;
	let tools: NamedTool[];
	let stroke_color = "#000000";
	let pressure_factor = 4;
	let min_dist_squared = 4 * 4;

	export function initialize(canvas: HTMLCanvasElement|string) {
		paper.setup(canvas);
		$("#color_change").change(evt => stroke_color = (<HTMLInputElement>evt.target).value);
		project = paper.project;
		tools = [new Brush(), new Pencil(), new Mover(), new Eraser()];
	}
	module UndoRedo {
		interface UndoItem {
			perform(is_undo: boolean): void;
		}
		export class DeleteItem implements UndoItem {
			constructor(public itm: paper.Item[]) { }
			perform(is_undo: boolean) {
				for (let i of this.itm) if (i) i.visible = !i.visible;
			}
		}
		export class ModifyItem implements UndoItem {
			constructor(public itm: paper.Item, public offset: paper.Point) { }
			perform(is_undo: boolean) {
				this.itm.translate(is_undo ? this.offset.multiply(-1) : this.offset);
			}
		}
		export class UndoRedoSystem {
			undoArray: UndoItem[] = [];
			redoArray: UndoItem[] = [];
			constructor(public limit = 200) { }
			limitUndo() {
				if (this.limit > 0)
					while (this.undoArray.length > this.limit) this.undoArray.shift();
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
					this.limitUndo();
				}
			}
			append(item: UndoItem) {
				this.undoArray.push(item);
				this.limitUndo();
				this.clear(this.redoArray);
			}
			clearAll() {
				this.clear(this.undoArray);
				this.clear(this.redoArray);
			}

			clear(r: UndoItem[]) {
				var arr: UndoItem;
				while (r.length > 0) {
					arr = r.shift();
					let items = arr instanceof DeleteItem ? arr.itm
						: arr instanceof ModifyItem ? [arr.itm] : [];
					for (let i of items)
						if (i && !i.visible) i.remove();
				}
			}
		}
	}

	let undoRedo = new UndoRedo.UndoRedoSystem();

	export function downloadSVG() {
		let out = paper.project.exportSVG({ asString: true });
		let a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([out], { type: "text/calendar" }));
		let date = new Date().toISOString().replace(/T/, " ").replace(/:/g, '.').substr(0, 19);
		(<any>a).download = `Drawing ${date}.svg`;
		a.click();
	}
	export function clearCanvas() {
		paper.project.clear();
		undoRedo.clearAll();
	}

	let path: paper.Path;
	let myLastPoint: paper.Point;

	class NamedTool extends paper.Tool {
		constructor(public name: string, public desc: string) {
			super();
		}
		onKeyDown = (event: paper.KeyEvent) => {
			switch (event.character) {
				case "1": addToStrokeWidthValue(-1); break;
				case "2": addToStrokeWidthValue(1); break;
				case "z": undoRedo.undo(); break;
				case "Z": undoRedo.redo(); break;
				case "E": clearLayer(); break;
				case "e": changeTool(Eraser); break;
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
			if (event.point.getDistance(myLastPoint, true) > min_dist_squared) {
				if (!path) {
					path = new paper.Path();
					path.fillColor = stroke_color;
					path.closed = true;
					path.add(myLastPoint);
				} else {
					path.lastSegment.remove();
				}
				var pressure = WebRTCPen.info.pressure || 1.0;
				var v = event.point.subtract(myLastPoint).divide(2);
				var vp = v.normalize().multiply(pressure).multiply(pressure_factor);
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
	class Pencil extends Brush {
		constructor() { super(); this.name = 'pencil'; }
		maxDistance = 8;
		onMouseDrag = (event: paper.ToolEvent) => {
			if (event.point.getDistance(myLastPoint, true) > min_dist_squared) {
				if (!path) {
					path = new paper.Path();
					path.strokeColor = stroke_color;
					path.closed = false;
					path.strokeWidth = +pressure_factor;
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
		target: paper.Item;
		onMouseDown = (event: paper.ToolEvent) => {
			for (let itm of project.selectedItems)
				itm.selected = false;
			var result = project.hitTest(event.point);
			if (result && result.item) {
				result.item.selected = true;
				this.target = result.item;
				myLastPoint = event.point;
			} else {
				this.target = null;
			}
		}
		onMouseDrag = (event: paper.ToolEvent) => {
			if (this.target) {
				this.target.translate(event.point.subtract(myLastPoint));
				myLastPoint = event.point;
			}
		}
		onMouseUp = (event: paper.ToolEvent) => {
			if (this.target) {
				undoRedo.append(new UndoRedo.ModifyItem(this.target, event.delta));
				this.target.selected = false;
				this.target = null;
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
	}
	function clearLayer() {
		var r: paper.Item[] = [];
		for (let i of project.activeLayer.children) {
			if (i.visible) {
				i.visible = false;
				r.push(i);
			}
		}
		undoRedo.append(new UndoRedo.DeleteItem(r));
	}

	function toggleDraft() {
		if (project.layers.length < 2) {
			new paper.Layer();
		} else {
			project.layers[0].moveAbove(project.layers[1]);
		}
		project.layers[0].opacity = 0.1;
		project.layers[1].opacity = 1.0;
		project.activeLayer = project.layers[1];
	}

	function changeTool(tool_class: typeof NamedTool) {
		let tool = tools.filter(tool => tool instanceof tool_class)[0];
		$('#current_tool').text(tool.name);
		$('#tool_description').text(tool.desc);
		tool.activate();
	}

	function addToStrokeWidthValue(n: number) {
		if (pressure_factor > 1 && pressure_factor < 20)
			$('#pressureFactorValue').text(pressure_factor += n);
	}
}