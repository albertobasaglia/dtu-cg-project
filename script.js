

async function init() {
    const canvas = document.getElementById('glCanvas');

    const obj_filename = "./data/cube.obj";
    const drawingInfo = await readOBJFile(obj_filename, 1.0, true);
    console.log(drawingInfo);


    const gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert('Your browser does not support WebGL');
    }

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

    // Get locations

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
        var proj = perspective(45, aspect_ratio, 0.1, 10);

        var camera_distance = 4.0;
        var camera_x = 0 * camera_distance;
        var camera_z = 1 * camera_distance;

        var eye = vec3(camera_x, 0, camera_z);

        var view = lookAt(eye, vec3(0, 0, 0), vec3(0, 1, 0));

        let clearColor = [0.2, 0.4, 0.3];

        gl.clearColor(...clearColor, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        model = mat4();
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
