function interpolate(a, b, t) {
    return a * (1 - t) + b * t;
}

async function init() {
    const canvas = document.getElementById('glCanvas');

    const gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert('Your browser does not support WebGL');
    }


    // Read all the obj files comprising the keyframes
    let drawingInfos = {};
    let frames = {"idle": [1, 10, 35, 85, 115, 125],
                  "wave": [1, 100, 150, 200, 250, 300],
                  "headbang": [1, 15, 90, 135, 150],
                  "jumpingjack": [1, 20, 35, 50, 65, 80, 100]};
    let frames_dst = "./data/keyframes_goblin/num.obj";
    let defaultScene = "idle";
    let currentScene = defaultScene;
    let queue = [];
    let fps = 60;
    for (const [scene, obj] of Object.entries(frames)) {
        drawingInfos[scene] = [];
        for (let frame of frames[scene]) {
            const obj_filename = frames_dst.replace("num", scene + "_" + frame);
            const drawingInfo = await readOBJFile(obj_filename, 1.0, true)
            drawingInfos[scene].push(drawingInfo);
        }
    }
    
    // Get a keypress event and change the scene
    function keyPress(event) {
        if (event.keyCode == 13) {
            queue.push("headbang");

            // Show the queue in the text field
            document.getElementById("showQueue").innerHTML = queue;
        }

        if (event.keyCode == 32) {
            queue.push("jumpingjack");
            document.getElementById("showQueue").innerHTML = queue;
        }

        if (event.keyCode == 87) {
            queue.push("wave");
            document.getElementById("showQueue").innerHTML = queue;
        }
    }
    document.addEventListener('keydown', keyPress);
    
    function getInterpolated(frame) {
        let currentDrawingInfos = drawingInfos[currentScene];
        let currentFrames = frames[currentScene];

        if (frame < currentFrames[0]) {
            return {vertices: currentDrawingInfos[0].vertices,
                    normals: currentDrawingInfos[0].normals,
                    colors: currentDrawingInfos[0].colors,
                    indices: currentDrawingInfos[0].indices};
        }

        if (frame >= currentFrames[currentFrames.length - 1]) {
            return {vertices: currentDrawingInfos[currentDrawingInfos.length - 1].vertices,
                    normals: currentDrawingInfos[currentDrawingInfos.length - 1].normals,
                    colors: currentDrawingInfos[currentDrawingInfos.length - 1].colors,
                    indices: currentDrawingInfos[currentDrawingInfos.length - 1].indices};
        }

        for (let i = 0; i < currentFrames.length - 1; i++) {
            if (frame >= currentFrames[i] && frame < currentFrames[i + 1]) {
                drawing_1 = currentDrawingInfos[i];
                drawing_2 = currentDrawingInfos[i + 1];

                // Interpolate between drawing_1 and drawing_2
                let t = (frame - currentFrames[i]) / (currentFrames[i + 1] - currentFrames[i]);
                let vertices = [];
                let normals = [];
                let colors = [];
                let indices = [];

                for (let j = 0; j < drawing_1.vertices.length; j++) {
                    let vertex = interpolate(drawing_1.vertices[j], drawing_2.vertices[j], t);
                    vertices.push(vertex);

                    let normal = interpolate(drawing_1.normals[j], drawing_2.normals[j], t);
                    normals.push(normal);

                    let color = interpolate(drawing_1.colors[j], drawing_2.colors[j], t);
                    colors.push(color);
                }

                for (let j = 0; j < drawing_1.indices.length; j++) {
                    indices.push(drawing_1.indices[j]);
                }

                return {vertices: new Float32Array(vertices),
                        normals: new Float32Array(normals),
                        colors: new Float32Array(colors),
                        indices: new Int32Array(indices)};
            }
        }
    }

    let drawingInfo = getInterpolated(0);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    var program = initShaders(gl, 'vertex-shader', 'fragment-shader');
    gl.useProgram(program);

    // Enable usage of u32 for webgl
    var ext = gl.getExtension('OES_element_index_uint');
    if (!ext) {
        console.log('Warning: Unable to use an extension');
    }

    aspect_ratio = canvas.width / canvas.height;


    // Get locations of attributes and uniforms
    let loc_a_position = gl.getAttribLocation(program, 'a_position');
    let loc_a_normal = gl.getAttribLocation(program, 'a_normal');
    let loc_a_color = gl.getAttribLocation(program, 'a_color');

    let loc_u_model = gl.getUniformLocation(program, 'u_model');
    let loc_u_view = gl.getUniformLocation(program, 'u_view');
    let loc_u_proj = gl.getUniformLocation(program, 'u_proj');
    let loc_u_lightPos = gl.getUniformLocation(program, 'u_lightPos');
    let loc_u_eye = gl.getUniformLocation(program, 'u_eye');

    let buffer_vertex = gl.createBuffer();
    let buffer_normal = gl.createBuffer();
    let buffer_color = gl.createBuffer();
    let buffer_index = gl.createBuffer();

    // Vertices buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_vertex);
    gl.vertexAttribPointer(loc_a_position, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_position);

    // Normals buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_normal);
    gl.vertexAttribPointer(loc_a_normal, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_normal);

    // Colors buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_color);
    gl.vertexAttribPointer(loc_a_color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_color);



    var lightPos = vec4(0, 0, -1, 0);


    const computeBuffers = (drawInfo) => {
        const indices = drawInfo.indices;
        const vertices = drawInfo.vertices;
        const normals = drawInfo.normals;
        const colors = drawInfo.colors;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_vertex);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_normal);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer_index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    let start_time = window.performance.now();
    let frametime = 1000.0/fps;
    let frame_base = 0;

    const render = () => {
        let current_time = window.performance.now();
        let delta = current_time - start_time;
        let frame_n = frame_base + Math.floor(delta / frametime);

        computeBuffers(getInterpolated(frame_n));

        var model = mat4();
        var proj = perspective(60, aspect_ratio, 0.1, 100);

        var eye = vec3(0, 3, 8);
        var at = vec3(0, 2.5, 0);
        var up = vec3(0, 1, 0);
        var view = lookAt(eye, at, up);

        let clearColor = [0.2, 0.4, 0.3];

        gl.clearColor(...clearColor, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(loc_u_model, false, flatten(model));
        gl.uniformMatrix4fv(loc_u_view, false, flatten(view));
        gl.uniformMatrix4fv(loc_u_proj, false, flatten(proj));
        gl.uniform4fv(loc_u_lightPos, lightPos);
        gl.uniform3fv(loc_u_eye, eye);

        gl.drawElements(gl.TRIANGLES, drawingInfo.indices.length, gl.UNSIGNED_INT, 0);

        if (frame_n >= frames[currentScene][frames[currentScene].length - 1]) {
            frame_base = 0;
            start_time = window.performance.now();
            
            if (queue.length > 0) {
                currentScene = queue.shift();

                // Remove that scene from the queue
                document.getElementById("showQueue").innerHTML = queue;
            } else {
                currentScene = defaultScene;
            }
        }

        requestAnimationFrame(render);
    };
    computeBuffers(getInterpolated(0));
    render();
}

window.onload = init;