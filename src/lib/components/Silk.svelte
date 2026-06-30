<script>
	import { onMount, onDestroy } from 'svelte';

	let {
		speed = 5,
		scale = 1,
		color = '#006b2c',
		noiseIntensity = 1.5,
		rotation = 0
	} = $props();

	let canvasRef;
	let gl;
	let program;
	let animationFrameId;
	let startTime = Date.now();

	function hexToNormalizedRGB(hex) {
		hex = hex.replace('#', '');
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
		}
		return [
			parseInt(hex.slice(0, 2), 16) / 255,
			parseInt(hex.slice(2, 4), 16) / 255,
			parseInt(hex.slice(4, 6), 16) / 255
		];
	}

	const vertexShaderSource = `
		attribute vec2 position;
		varying vec2 vUv;
		void main() {
			vUv = position * 0.5 + 0.5;
			gl_Position = vec4(position, 0.0, 1.0);
		}
	`;

	const fragmentShaderSource = `
		precision highp float;
		varying vec2 vUv;

		uniform float uTime;
		uniform vec3  uColor;
		uniform float uSpeed;
		uniform float uScale;
		uniform float uRotation;
		uniform float uNoiseIntensity;

		const float e = 2.71828182845904523536;

		float noise(vec2 texCoord) {
			float G = e;
			vec2  r = (G * sin(G * texCoord));
			return fract(r.x * r.y * (1.0 + texCoord.x));
		}

		vec2 rotateUvs(vec2 uv, float angle) {
			float c = cos(angle);
			float s = sin(angle);
			mat2  rot = mat2(c, -s, s, c);
			return rot * uv;
		}

		void main() {
			float rnd        = noise(gl_FragCoord.xy);
			vec2  centeredUv = vUv - 0.5;
			vec2  uv         = rotateUvs(centeredUv * uScale, uRotation) + 0.5;
			vec2  tex        = uv * uScale;
			float tOffset    = uSpeed * uTime;

			tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

			float pattern = 0.6 +
							0.4 * sin(5.0 * (tex.x + tex.y +
											 cos(3.0 * tex.x + 5.0 * tex.y) +
											 0.02 * tOffset) +
									 sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

			vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
			col.a = 1.0;
			gl_FragColor = col;
		}
	`;

	function createShader(gl, type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
			gl.deleteShader(shader);
			return null;
		}
		return shader;
	}

	function initWebGL() {
		if (!canvasRef) return;
		gl = canvasRef.getContext('webgl') || canvasRef.getContext('experimental-webgl');
		if (!gl) {
			console.error('WebGL not supported');
			return;
		}

		const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Program linking error:', gl.getProgramInfoLog(program));
			return;
		}

		gl.useProgram(program);

		const vertices = new Float32Array([
			-1, -1,
			 1, -1,
			-1,  1,
			-1,  1,
			 1, -1,
			 1,  1
		]);

		const buffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

		const positionLocation = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(positionLocation);
		gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

		resizeCanvas();
		window.addEventListener('resize', resizeCanvas);

		animate();
	}

	function resizeCanvas() {
		if (!canvasRef || !gl) return;
		const displayWidth  = canvasRef.clientWidth;
		const displayHeight = canvasRef.clientHeight;

		if (canvasRef.width  !== displayWidth ||
			canvasRef.height !== displayHeight) {
			canvasRef.width  = displayWidth;
			canvasRef.height = displayHeight;
			gl.viewport(0, 0, canvasRef.width, canvasRef.height);
		}
	}

	function animate() {
		if (!gl || !program) return;

		const time = (Date.now() - startTime) / 1000.0;

		const uTime = gl.getUniformLocation(program, 'uTime');
		const uColor = gl.getUniformLocation(program, 'uColor');
		const uSpeed = gl.getUniformLocation(program, 'uSpeed');
		const uScale = gl.getUniformLocation(program, 'uScale');
		const uRotation = gl.getUniformLocation(program, 'uRotation');
		const uNoiseIntensity = gl.getUniformLocation(program, 'uNoiseIntensity');

		gl.uniform1f(uTime, time);
		gl.uniform3fv(uColor, hexToNormalizedRGB(color));
		gl.uniform1f(uSpeed, speed);
		gl.uniform1f(uScale, scale);
		gl.uniform1f(uRotation, rotation);
		gl.uniform1f(uNoiseIntensity, noiseIntensity);

		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		animationFrameId = requestAnimationFrame(animate);
	}

	onMount(() => {
		initWebGL();
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', resizeCanvas);
		}
	});
</script>

<canvas bind:this={canvasRef} class="w-full h-full block bg-transparent pointer-events-none"></canvas>
