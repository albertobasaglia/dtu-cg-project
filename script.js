function initQuat(z_dir) {
    var q_rot = new Quaternion();
    var q_inc = new Quaternion();
    q_rot = q_rot.make_rot_vec2vec(vec3([0, 0, 1]), normalize(z_dir));
    var q_rot_inv = new Quaternion(q_rot);
    q_rot_inv.invert();
    return [q_rot, q_inc, q_rot_inv];
}

async function init() {
    const canvas = document.getElementById('glCanvas');
    const animationMenu = document.getElementById("animationMenu");
    const interactiveDiv = document.getElementById("interactive-div");
    const inspectDiv = document.getElementById("inspect-div");
    const exitBtn = document.getElementById("exit");
    const currentFrame = document.getElementById("currentFrame");
    const playPause = document.getElementById("playpause");
    const prevFrame = document.getElementById("prevframe");
    const nextFrame = document.getElementById("nextframe");
    const slider = document.getElementById("range");

    const gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert('Your browser does not support WebGL');
    }


    // Read all the obj files comprising the keyframes
    let mode = "interactive"; // "interactive" or "inspect"
    let defaultScene = "idle";
    let fps = 60;

    let frame_base = 0; // current "starting" frame in the run
    let pause_time; // time when "Pause" was clicked
    let start_time = window.performance.now(); // starting time of the run
    // a run is started by Play and concluded by Pause
    // at the end of a run, the frame_base is updated to the current frame
    // and the pause_time is updated to the current time
    let paused = true; // whether the animation is paused

    let currentScene = defaultScene;
    let drawingInfos = {};
    let frames = {"idle": [1, 10, 35, 85, 115, 125],
                  "wave": [1, 100, 150, 200, 250, 300],
                  "headbang": [1, 15, 90, 135, 150],
                  "jumpingjack": [1, 20, 35, 50, 65, 80, 100]};

    let leave_interactive = () => {
        mode = "interactive";
        interactiveDiv.style.display = "block";
        inspectDiv.style.display = "none";
        animationMenu.style.display = "inline-block";
        currentScene = defaultScene;
        frame_base = 0;
        paused = true;
        playPause.textContent = "Play";
    };

    exitBtn.addEventListener("click", leave_interactive);



    function updateInputs() {
        if (!paused) {
            prevFrame.disabled = true;
            nextFrame.disabled = true;
            return;
        }
        if (frame_base == 0) {
            prevFrame.disabled = true;
        } else {
            prevFrame.disabled = false;
        }

        if (frame_base == parseInt(slider.max)) {
            nextFrame.disabled = true;
        } else {
            nextFrame.disabled = false;
        }

        slider.value = frame_base;
    }

    slider.addEventListener("input", function() {
        frame_base = parseInt(slider.value);
        updateInputs();
    });

    nextFrame.addEventListener("click", function() {
        frame_base += 1;
        updateInputs();
    });

    prevFrame.addEventListener("click", function() {
        frame_base -= 1;
        updateInputs();
    });

    let do_pause = () => {
        paused = true;
        playPause.textContent = "Play";
        pause_time = window.performance.now();
        frame_base += Math.floor((pause_time - start_time) / frametime);
    }

    let do_play = () => {
        paused = false;
        playPause.textContent = "Pause";
        start_time = window.performance.now();
    }

    playPause.addEventListener("click", function() {
        if (paused) {
            do_play();
        } else {
            do_pause();
        }
    });

    function writeAnimationMenu(frames) {
        for (const [scene, obj] of Object.entries(frames)) {
            let newdiv = document.createElement("button");
            newdiv.textContent = scene;
            animationMenu.appendChild(newdiv);

            newdiv.addEventListener("click", function() {
                mode = "inspect";
                currentScene = scene;
                interactiveDiv.style.display = "none";
                inspectDiv.style.display = "block";
                animationMenu.style.display = "none";
                prevFrame.disabled = true;

                slider.min = 0;
                slider.max = frames[scene][frames[scene].length - 1];
                slider.value = 0;

                pause_time = window.performance.now();
                start_time = window.performance.now();
                frame_base = 0;
            });
        }
    }


    writeAnimationMenu(frames);
    let frames_dst = "./data/keyframes_goblin/num.obj";
    let queue = [];
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
        if (event.keyCode == 13) { // Enter key
            queue.push("headbang");

            // Show the queue in the text field
            document.getElementById("showQueue").innerHTML = queue;
        }

        if (event.keyCode == 32) { // Space key
            queue.push("jumpingjack");
            document.getElementById("showQueue").innerHTML = queue;
        }

        if (event.keyCode == 87) { // w key
            queue.push("wave");
            document.getElementById("showQueue").innerHTML = queue;
        }

        // Reset quaternion rotation
        if (event.keyCode == 82) { // r key
            [q_rot, q_inc, q_rot_inv] = initQuat(z_dir);
            up = q_rot_inv.apply(up);
            eye_pan = vec3(0, 0, eye_dist);
        }
    }
    document.addEventListener('keydown', keyPress);

    // Interpolate between two keyframes
    function getInterpolated(frame) {
        let currentDrawingInfos = drawingInfos[currentScene];
        let currentFrames = frames[currentScene];

        let mesh1, mesh2, t;

        // If the frame is before the first keyframe
        if (frame < currentFrames[0]) {
            mesh1 = {vertices: currentDrawingInfos[0].vertices,
                    normals: currentDrawingInfos[0].normals,
                    colors: currentDrawingInfos[0].colors,
                    indices: currentDrawingInfos[0].indices};
            mesh2 = mesh1;
            t = 0.0;
            return [mesh1, mesh2, t];
        }

        // If the frame is after the last keyframe
        if (frame >= currentFrames[currentFrames.length - 1]) {
            mesh2 = {vertices: currentDrawingInfos[currentDrawingInfos.length - 1].vertices,
                    normals: currentDrawingInfos[currentDrawingInfos.length - 1].normals,
                    colors: currentDrawingInfos[currentDrawingInfos.length - 1].colors,
                    indices: currentDrawingInfos[currentDrawingInfos.length - 1].indices};
            mesh1 = mesh2;
            t = 1.0;
            return [mesh1, mesh2, t];
        }

        // Find the two keyframes to interpolate between
        for (let i = 0; i < currentFrames.length - 1; i++) {
            if (frame >= currentFrames[i] && frame < currentFrames[i + 1]) {
                drawing_1 = currentDrawingInfos[i];
                drawing_2 = currentDrawingInfos[i + 1];

                let t = (frame - currentFrames[i]) / (currentFrames[i + 1] - currentFrames[i]);
                mesh1 = drawing_1;
                mesh2 = drawing_2;

                return [mesh1, mesh2, t];
            }
        }
    }

    // Initialize WebGL
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    var program = initShaders(gl, 'vertex-shader', 'fragment-shader');
    gl.useProgram(program);

    let clearColor = [0.8, 0.4, 0.1];
    gl.clearColor(...clearColor, 1.0);

    // Enable usage of u32 for webgl
    var ext = gl.getExtension('OES_element_index_uint');
    if (!ext) {
        console.log('Warning: Unable to use an extension');
    }


    // Get locations of attributes and uniforms
    let loc_a_position1 = gl.getAttribLocation(program, 'a_position1');
    let loc_a_normal1 = gl.getAttribLocation(program, 'a_normal1');
    let loc_a_color1 = gl.getAttribLocation(program, 'a_color1');

    let loc_a_position2 = gl.getAttribLocation(program, 'a_position2');
    let loc_a_normal2 = gl.getAttribLocation(program, 'a_normal2');
    let loc_a_color2 = gl.getAttribLocation(program, 'a_color2');

    let loc_u_model = gl.getUniformLocation(program, 'u_model');
    let loc_u_view = gl.getUniformLocation(program, 'u_view');
    let loc_u_proj = gl.getUniformLocation(program, 'u_proj');
    let loc_u_lightPos = gl.getUniformLocation(program, 'u_lightPos');
    let loc_u_eye = gl.getUniformLocation(program, 'u_eye');
    let loc_u_t = gl.getUniformLocation(program, 'u_t');

    // Create buffers
    let buffer_vertex1 = gl.createBuffer();
    let buffer_normal1 = gl.createBuffer();
    let buffer_color1 = gl.createBuffer();
    let buffer_vertex2 = gl.createBuffer();
    let buffer_normal2 = gl.createBuffer();
    let buffer_color2 = gl.createBuffer();
    let buffer_index = gl.createBuffer();

    // Vertices buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_vertex1);
    gl.vertexAttribPointer(loc_a_position1, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_position1);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_vertex2);
    gl.vertexAttribPointer(loc_a_position2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_position2);

    // Normals buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_normal1);
    gl.vertexAttribPointer(loc_a_normal1, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_normal1);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_normal2);
    gl.vertexAttribPointer(loc_a_normal2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_normal2);

    // Colors buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_color1);
    gl.vertexAttribPointer(loc_a_color1, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_color1);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer_color2);
    gl.vertexAttribPointer(loc_a_color2, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc_a_color2);


    // Variable declarations
    let aspect_ratio = canvas.width / canvas.height;
    let frametime = 1000.0/fps;
    var lightPos = vec4(0, 0, -1, 0);


    const loadBuffer = (drawInfo, buffer_vertex, buffer_normal, buffer_color, buffer_index) => {
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

    // Helper functions
    const computeBuffers = (drawInfo1, drawInfo2) => {
        loadBuffer(drawInfo1, buffer_vertex1, buffer_normal1, buffer_color1, buffer_index);
        loadBuffer(drawInfo2, buffer_vertex2, buffer_normal2, buffer_color2, buffer_index);
    }

    // Project an x,y pair onto a sphere of radius r OR a hyperbolic sheet
    // if we are away from the center of the sphere.
    function project_to_sphere(x, y) {
        var r = 2;
        var d = Math.sqrt(x * x + y * y);
        var t = r * Math.sqrt(2);
        var z;
        if (d < r)  // Inside sphere
            z = Math.sqrt(r * r - d * d);
        else if (d < t)
            z = 0;
        else        // On hyperbola
            z = t * t / d;
        return z;
    }


    // Trackball
    var eye = vec3(0, 3, 6);
    var at = vec3(0, 2.5, 0);
    var up = vec3(0, 1, 0);
    var z_dir = subtract(eye, at);
    var eye_dist = length(z_dir);
    var eye_pan = vec3(0, 0, eye_dist);

    // Initialize quaternions
    var [q_rot, q_inc, q_rot_inv] = initQuat(z_dir);
    up = q_rot_inv.apply(up);

    // Mouse movement
    var x0 = 0; var y0 = 0;
    var moving = false;
    var lastTime = Date.now();
    var action = 0; // 0: no action, 1: rotate, 2: dolly, 3: pan


    // When the mouse is pressed
    canvas.onmousedown = function (ev) {
        x = ev.clientX; y = ev.clientY;

        // Start dragging if a mouse is in <canvas>
        var rect = ev.target.getBoundingClientRect();
        if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
            x0 = x; y0 = y;
            moving = true;
            action = ev.button + 1; // each mouse button has a different value
        }
    };

    // Disable right-click context menu
    canvas.oncontextmenu = function (ev) { ev.preventDefault(); };

    // When the mouse is moved
    canvas.onmousemove = function (ev) {
        if (moving) {
            var now = Date.now();
            var elapsed = now - lastTime;
            if (elapsed > 10) {
                lastTime = now;

                var x = ev.clientX; var y = ev.clientY;
                var rect = ev.target.getBoundingClientRect();
                var s_x = ((x - rect.left) / rect.width - 0.5) * 2;
                var s_y = (0.5 - (y - rect.top) / rect.height) * 2;
                var s_last_x = ((x0 - rect.left) / rect.width - 0.5) * 2;
                var s_last_y = (0.5 - (y0 - rect.top) / rect.height) * 2;

                switch (action) {
                    case 1: {// Rotate
                        var u = new vec3([s_x, s_y, project_to_sphere(s_x, s_y)]);
                        var v = new vec3([s_last_x, s_last_y, project_to_sphere(s_last_x, s_last_y)]);
                        q_inc = q_inc.make_rot_vec2vec(normalize(u), normalize(v));
                        break;
                    }
                    case 2: {// Dolly
                        eye_pan[2] += (s_y - s_last_y) * eye_pan[2];
                        eye_pan[2] = Math.max(0.1, eye_pan[2]);
                        break;
                    }
                    case 3: {// Pan
                        eye_pan[0] += (s_x - s_last_x) * eye_pan[2] * 0.25;
                        eye_pan[1] += (s_y - s_last_y) * eye_pan[2] * 0.25;
                        break;
                    }
                }
                x0 = x; y0 = y;
            }
        }
    };

    // When the mouse is released
    canvas.onmouseup = function (ev) {
        var x = ev.clientX; var y = ev.clientY;
        if(x0 == x && y0 == y) {
            q_inc.setIdentity();
        }
        moving = false;
        action = 0;
    };

    // If the mouse is out of the canvas
    canvas.onmouseleave = function (_) {
        moving = false;
        action = 0;
    }

    // Canvas event listeners
    canvas.addEventListener("touchstart", function (ev) {
        ev.preventDefault();
        if (ev.targetTouches.length === 1) {
            var touch = ev.targetTouches[0];
            touch.preventDefault = function () { };
            touch.button = 0;
            canvas.onmousedown(touch);
            this.addEventListener("touchmove", roll, false);
            this.addEventListener("touchend", release, false);

            function roll(e) {
                touch = e.targetTouches[0];
                canvas.onmousemove(touch);
                console.log("touchmove");
            }
            function release() {
                canvas.onmouseup(touch);
                this.removeEventListener("touchmove", roll);
                this.removeEventListener("touchend", release);
            }
        }
    });


    // Render function
    const render = () => {
        // Update the frame number
        let current_time = window.performance.now();

        // Compute the time elapsed since the last frame
        let delta = current_time - start_time;

        let frame_n = frame_base;

        // the frame is updated only if the animation is not paused
        if(mode == "interactive" || !paused) {
            frame_n += Math.floor(delta / frametime);
        }

        [mesh1, mesh2, t] = getInterpolated(frame_n);
        computeBuffers(mesh1, mesh2);
        gl.uniform1f(loc_u_t, t);


        // Define the model, view and projection matrices
        var model = mat4(); // identity matrix
        var fovy = 60; var near = 0.1; var far = 100;
        var proj = perspective(fovy, aspect_ratio, near, far);

        // Rotate view with quaternion
        q_rot = q_rot.multiply(q_inc);
        var rot_up = q_rot.apply(up);
        var right = q_rot.apply(vec3(1, 0, 0));
        var centre = vec3([at[0] - right[0] * eye_pan[0] - rot_up[0] * eye_pan[1], at[1] - right[1] * eye_pan[0] - rot_up[1] * eye_pan[1], at[2] - right[2] * eye_pan[0] - rot_up[2] * eye_pan[1]]);
        var rot_eye = q_rot.apply(vec3(0, 0, eye_pan[2]));

        var view = lookAt(add(rot_eye, centre), centre, rot_up); // Rotate using quaternion


        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(loc_u_model, false, flatten(model));
        gl.uniformMatrix4fv(loc_u_view, false, flatten(view));
        gl.uniformMatrix4fv(loc_u_proj, false, flatten(proj));
        gl.uniform4fv(loc_u_lightPos, lightPos);
        gl.uniform3fv(loc_u_eye, eye);

        gl.drawElements(gl.TRIANGLES, mesh1.indices.length, gl.UNSIGNED_INT, 0);

        if(mode == "interactive") {
            if (frame_n >= frames[currentScene][frames[currentScene].length - 1]) {
                frame_base = 0;
                start_time = window.performance.now();

                if (queue.length > 0) {
                    // Get the first scene from the queue
                    currentScene = queue.shift();
                    // Remove the that scene from the displayed queue
                    document.getElementById("showQueue").innerHTML = queue;
                } else {
                    currentScene = defaultScene;
                }
            }
        } else {
            // Update the current frame number in the UI
            updateInputs();
            currentFrame.innerHTML = frame_n;
            slider.value = frame_n;
            if (frame_n > frames[currentScene][frames[currentScene].length - 1]) {
                frame_base = 0;
                start_time = window.performance.now();
                frame_n = 0;
            }
        }

        requestAnimationFrame(render);
    };

    [mesh1, mesh2, t] = getInterpolated(0);
    computeBuffers(mesh1, mesh2);
    gl.uniform1f(loc_u_t, t);
    render();
}

window.onload = init;
