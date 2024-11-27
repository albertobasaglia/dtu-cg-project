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
    let drawingInfos = [];
    let frames = [1, 40, 70, 80, 140, 160, 180, 210, 225];
    let frames_dst = "./data/keyframes_cube/num.obj";
    for (let frame of frames) {
        const obj_filename = frames_dst.replace("num", frame);
        const drawingInfo = await readOBJFile(obj_filename, 1.0, true)
        drawingInfos.push(drawingInfo);
    }
    console.log(drawingInfos);

    function getInterpolated(frame) {
        if (frame < frames[0]) {
            return {vertices: drawingInfos[0].vertices,
                    normals: drawingInfos[0].normals,
                    colors: drawingInfos[0].colors,
                    indices: drawingInfos[0].indices};
        }

        if (frame >= frames[frames.length - 1]) {
            return {vertices: drawingInfos[drawingInfos.length - 1].vertices,
                    normals: drawingInfos[drawingInfos.length - 1].normals,
                    colors: drawingInfos[drawingInfos.length - 1].colors,
                    indices: drawingInfos[drawingInfos.length - 1].indices};
        }

        for (let i = 0; i < frames.length - 1; i++) {
            if (frame >= frames[i] && frame < frames[i + 1]) {
                drawing_1 = drawingInfos[i];
                drawing_2 = drawingInfos[i + 1];

                // Interpolate between drawing_1 and drawing_2
                let t = (frame - frames[i]) / (frames[i + 1] - frames[i]);
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
    console.log(drawingInfo);
    
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


    const computeBuffers = () => {
        const indices = drawingInfo.indices;
        const vertices = drawingInfo.vertices;
        const normals = drawingInfo.normals;
        const colors = drawingInfo.colors;

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_vertex);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_normal);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer_color);
        gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer_index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }

    const render = () => {
        var model = mat4();
        var proj = perspective(60, aspect_ratio, 0.1, 100);

        var eye = vec3(12, 2, 0);
        var at = vec3(0, -2.5, -3.33);
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


        requestAnimationFrame(render);
    };
    computeBuffers();
    render();
}

window.onload = init;
