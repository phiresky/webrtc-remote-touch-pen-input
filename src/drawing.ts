// adapted from https://github.com/shspage/paperjs-pressure-pdfout
module PenDrawing {
	let project: paper.Project;
	export function initialize(canvas: HTMLCanvasElement|string) {
		paper.setup(canvas);
		project = paper.project;
		paper.tool = new paper.Tool();
		paper.tool.maxDistance = 8;
		paper.tool.onMouseDown = onMouseDown;
		paper.tool.onMouseUp = onMouseUp;
		paper.tool.onKeyDown = onKeyDown;
		paper.tool.onMouseDrag = onMouseDrag;
		
	}
	
	var kUndoLimit = 200;


	class UndoRedoSystemArray {
		r = [];
		constructor(public name) {
			this.name = name;
		}
		clear() {
			var arr, typ, itm;
			while (this.r.length > 0) {
				arr = this.r.shift();
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

		store(arr) {
			this.r.push(arr);
			if (kUndoLimit > 0 && this.name == "undo") {
				while (this.r.length > kUndoLimit) { this.r.shift(); }
			}
		}
	};
	class UndoRedoSystem {
		undoArray = new UndoRedoSystemArray("undo");
		redoArray = new UndoRedoSystemArray("redo");
		_perform(arr, is_undo) {
			let itm = arr[1];
			if (arr[0] == "d") {
				if (itm) itm.visible = !itm.visible;

			} else if (arr[0] == "dd") {
				for (let i of itm) if (i) i.visible = !i.visible;
			} else if (arr[0] == "m") {
				itm.translate(is_undo ? arr[2] : arr[3]);
			}
		}
		undo() {
			if (this.undoArray.r.length > 0) {
				var arr = this.undoArray.r.pop();
				this._perform(arr, true);
				this.redoArray.store(arr);
			}
		}
		redo() {
			if (this.redoArray.r.length > 0) {
				var arr = this.redoArray.r.pop();
				this._perform(arr, false);
				this.undoArray.store(arr);
			}
		}
		append(arr) {
			this.undoArray.store(arr);
			this.redoArray.clear();
		}
		clearAll() {
			this.undoArray.clear();
			this.redoArray.clear();
		}
	}

	let undoRedo = new UndoRedoSystem();
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
	
	var path;
	let myLastPoint:paper.Point;
	
	var opt = {
	    tool_name : "brush",
	    stroke_color:"#000000",
	    pressure_factor:8,
	    min_dist_squared:4 * 4,
	    target_item : null,
	    tool_desc : {
	        "brush" : "drag to draw",
	        "eraser" : "CLICK to erase",
	        "mover" : "drag to move",
	        "pencil" : "drag to draw" }
	};
	
	function onMouseDown(event) {
	    if(opt.tool_name == "brush" || opt.tool_name == "pencil"){
	        myLastPoint = event.point;
	        
	    } else if(opt.tool_name == "mover"){
	        for(var i=0; i < project.selectedItems.length; i++){
	            project.selectedItems[i].selected = false;
	        }
	        var result = project.hitTest(event.point);
	        if(result && result.item){
	            result.item.selected = true;
	            opt.target_item = result.item;
	            myLastPoint = event.point;
	        } else {
	            opt.target_item = null;
	        }
	        
	    } else if(opt.tool_name == "eraser"){
	        var result = project.hitTest(event.point);
	        if(result && result.item){
	            result.item.visible = false;
	            undoRedo.append(["d", result.item]);
	        }
	    }
	}
	
	function onMouseDrag(event:paper.ToolEvent) {
	    if(opt.tool_name == "brush" || opt.tool_name == "pencil"){
	        if( event.point.getDistance(myLastPoint, true) > opt.min_dist_squared){
	            if (!path) {
	                path = new paper.Path();
	                if(opt.tool_name == "brush"){
	                    path.fillColor = opt.stroke_color;
	                    path.closed = true;
	                } else { // pencil
	                    path.strokeColor = opt.stroke_color;
	                    path.closed = false;
	                    path.strokeWidth = opt.pressure_factor|0;
	                }
	                path.add(myLastPoint);
	            } else {
	                if(opt.tool_name == "brush"){
	                    path.lastSegment.remove();
	                }
	            }
	            
	            if(opt.tool_name == "brush"){
	                var pressure = WebRTCPen.info.pressure || 1.0;
	                var v = event.point.subtract(myLastPoint).divide(2);
	                var vp = v.normalize().multiply(pressure).multiply(opt.pressure_factor);
	                vp.angle = vp.angle + 90;
	                
	                path.add(myLastPoint.add(v).add(vp));
	                path.insert(0, myLastPoint.add(v).subtract(vp));
	            }
	            
	            path.add(event.point);
	            path.smooth();
	            
	            myLastPoint = event.point;
	        }
	        
	    } else if(opt.tool_name == "mover"){
	        if(opt.target_item){
	            opt.target_item.translate( event.point.subtract( myLastPoint));
	            myLastPoint = event.point;
	        }
	    }
	}
	
	function onMouseUp(event:paper.ToolEvent) {
	    if(opt.tool_name == "brush" || opt.tool_name == "pencil"){
	        if(path){
	            if(path.segments.length < 2){
	                path.remove();
	            } else {
	                path.simplify();
	                
	                undoRedo.append(["d", path]);
	            }
	            path = null;
	        }
	    } else if(opt.tool_name == "mover"){
	        if(opt.target_item){
	            undoRedo.append(["m", opt.target_item,
	                             event.delta.multiply(-1), event.delta]);
	            opt.target_item.selected = false;
	            opt.target_item = null;
	        }
	    }
	}
	
	function clearLayer(){
	    var r = [];
	    var cs = project.activeLayer.children;
	    for(var i=0; i<cs.length; i++){
	        if(cs[i].visible){
	            cs[i].visible = false;
	            r.push(cs[i]);
	        }
	    }
	    undoRedo.append(["dd", r]);
	}
	
	function toggleDraft(){
	    if(project.layers.length < 2){
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
	
	function changeTool(tool_name){
	    opt.tool_name = tool_name;
	    document.getElementById('current_tool').innerHTML = tool_name;
	    document.getElementById('tool_description').innerHTML = opt.tool_desc[tool_name];
	}
	
	function addToStrokeWidthValue( n ){
	    if( opt.pressure_factor > 1 && opt.pressure_factor < 20 ){
	        opt.pressure_factor += n;
	        document.getElementById('pressureFactorValue').innerHTML = ""+opt.pressure_factor;
	    }
	}
	
	function onKeyDown(event){
	    switch(event.key){
	    case "1": addToStrokeWidthValue( -1 ); break;
	    case "2": addToStrokeWidthValue( 1 ); break;
	    case "z":
	        if( event.modifiers.shift ){
	            undoRedo.redo(); break;
	        } else {
	            undoRedo.undo(); break;
	        }
	    case "e":
	        if( event.modifiers.shift ){
	            clearLayer(); break;
	        } else {
	            changeTool("eraser"); break;
	        }
	    case "b": changeTool("brush"); break;
	    case "m": changeTool("mover"); break;
	    case "n": changeTool("pencil"); break;
	    case "t": toggleDraft(); break;
	    }
	}
}