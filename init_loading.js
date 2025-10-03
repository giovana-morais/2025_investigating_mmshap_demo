// --- Helper function to prevent excessive re-rendering on resize ---
function debounce(func, delay = 250) {
	let timeoutId;
	return (...args) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			func.apply(this, args);
		}, delay);
	};
}

// ugly hack to calculate the first grid plot size before adding it to DOM
// based on here: https://stackoverflow.com/questions/2921428/dom-element-width-before-appended-to-dom
function measure(el, mainContainer) {
	    el.style.visibility = 'hidden';
	    el.style.position = 'absolute';

	    mainContainer.appendChild(el);
	    var result = el.clientWidth;
	    mainContainer.removeChild(el);

			console.log("result", result);

	    return result;
}

// --- Main function to initialize and draw all visualizations ---
async function drawAllVisualizations() {
	// Clear the global playhead updaters to avoid duplicates on redraw
	if (window.updatePlayheads) {
		window.updatePlayheads = [];
	}

	const paramsStr = window.location.search;
	const searchParams = new URLSearchParams(paramsStr);
	const qid = searchParams.get("qid");

	if(qid) {
		document.getElementById("audio-player").innerHTML = `<source src="data/audio/${qid}.wav" type="audio/wav">`;
	}

	const models = ["qwen", "mu"];
	const exps = ["fs", "zs"];

	// build our grip
	for (const model of models) {
		for (const exp of exps) {
			console.log(`processing data for ${model}-${exp}`);

			const mainContainer = document.getElementById(`${model}-${exp}-container`);
			// clear any previous visualizations in this container before drawing a new one
			mainContainer.innerHTML = '';

			const plotId = `${model}-${exp}-plot`;
			const dataFile = `data/${qid}_${model}_${exp}.json`;

			const questionContainerId = `${plotId}-question`;
			const answerContainerId = `${plotId}-answer`;
			const audioContainerId = `${plotId}-audio`;

			const plotContainer = document.createElement('div');

			const experimentModel = model == "qwen" ? "Qwen-Audio" : "MU-LLaMA";
			const experimentName = exp == "fs" ? "MC-PI" : "MC-NPI";

			plotContainer.className = 'plot-container';
			plotContainer.id = `${plotId}-wrapper`;
			plotContainer.innerHTML = `
				<h3 style="text-align:center;">${experimentModel} ${experimentName}</h3>
				<div class="plot-header">
					<p id="${plotId}-current-view">Current viewing aggregate values</p>
					<button id="${plotId}-reset-button" class="reset-button">Reset View</button>
				</div>
				<div class="plot-header">
					<p>Audio stats:</p>
					<p id="${plotId}-audio-stats"></p>
					<p>Question stats:</p>
					<p id="${plotId}-question-stats"></p>
				</div>
				<div id="${plotId}-question" class="question-container"></div>
				<div id="${plotId}-answer" class="answer-container"></div>
				<div id="${plotId}-audio"></div>
			`;
			mainContainer.appendChild(plotContainer);

			try {
				// using this measure function to avoid the first plot shrinking
				const containerWidth = measure(plotContainer.cloneNode(true), mainContainer);
				const vizWidth = (containerWidth / 2) - 40;
				const vizHeight = 300;

				const data = await d3.json(dataFile);

				document.getElementById("qid").innerHTML = `track_id = ${data.title}, qid = ${qid}`;

				const original_question_shapley = Array.isArray(data.question_shapley_values[0]) ? data.question_shapley_values : null;
				const original_audio_shapley = Array.isArray(data.audio_shapley_values[0]) ? data.audio_shapley_values : null;

				const aggregated_question_shapley = original_question_shapley ? original_question_shapley.map(d => d3.sum(d)) : data.question_shapley_values;
				const aggregated_audio_shapley = original_audio_shapley ? original_audio_shapley.map(d => d3.sum(d)) : data.audio_shapley_values;

				const handleTokenClick = (answer_token, i) => {
					if (!original_question_shapley || !original_audio_shapley) return;

					const currentTime = document.getElementById('audio-player').currentTime;

					// plot-header info
					document.getElementById(`${plotId}-current-view`).innerHTML = `Current viewing results for t = ${answer_token}`
					const {maxAudio, minAudio, medianAudio, maxText, minText, medianText} = getStats(d3.transpose(original_audio_shapley)[i], d3.transpose(original_question_shapley)[i]);
					document.getElementById(`${plotId}-audio-stats`).innerHTML = `max: ${maxAudio}, min: ${minAudio}, median: ${medianAudio}`
					document.getElementById(`${plotId}-question-stats`).innerHTML = `max: ${maxText}, min: ${minText}, median: ${medianText}`

					const perTokenConfig = {
						...data, questionContainerId, answerContainerId, audioContainerId,
						onTokenClick: handleTokenClick,
						question_shapley_values: d3.transpose(original_question_shapley)[i],
						audio_shapley_values: d3.transpose(original_audio_shapley)[i],
						highlightedTokenIndex: i,
						initialPlayheadTime: currentTime,
						totalWidth: vizWidth, totalHeight: vizHeight
					};
					createModalityVisualization(perTokenConfig);
				};

				const handleResetClick = () => {
					console.log(`Resetting view for ${model}-${exp}`);
					// plot-header info
					document.getElementById(`${plotId}-current-view`).innerHTML = "Current viewing aggregate values"
					const {maxAudio, minAudio, medianAudio, maxText, minText, medianText} = getStats(aggregated_audio_shapley, aggregated_question_shapley);
					document.getElementById(`${plotId}-audio-stats`).innerHTML = `max: ${maxAudio}, min: ${minAudio}, median: ${medianAudio}`
					document.getElementById(`${plotId}-question-stats`).innerHTML = `max: ${maxText}, min: ${minText}, median: ${medianText}`

					const currentTime = document.getElementById('audio-player').currentTime;
					const defaultConfig = {
						...data, questionContainerId, answerContainerId, audioContainerId,
						onTokenClick: handleTokenClick,
						question_shapley_values: aggregated_question_shapley,
						audio_shapley_values: aggregated_audio_shapley,
						highlightedTokenIndex: null,
						initialPlayheadTime: currentTime,
						totalWidth: vizWidth, totalHeight: vizHeight
					};
					createModalityVisualization(defaultConfig);
				};

				// the repetition of this block is bothering me, but i won't fix it now.
				document.getElementById(`${plotId}-reset-button`).addEventListener('click', handleResetClick);
				const {maxAudio, minAudio, medianAudio, maxText, minText, medianText} = getStats(aggregated_audio_shapley, aggregated_question_shapley);
					document.getElementById(`${plotId}-audio-stats`).innerHTML = `max: ${maxAudio}, min: ${minAudio}, median: ${medianAudio}`
					document.getElementById(`${plotId}-question-stats`).innerHTML = `max: ${maxText}, min: ${minText}, median: ${medianText}`

				const vizConfig = {
					...data, questionContainerId, answerContainerId, audioContainerId,
					onTokenClick: handleTokenClick,
					question_shapley_values: aggregated_question_shapley,
					audio_shapley_values: aggregated_audio_shapley,
					totalWidth: vizWidth, totalHeight: vizHeight
				};

				createModalityVisualization(vizConfig);

			} catch (error) {
				console.error(`Failed to load data file: ${dataFile}`, error);
				mainContainer.innerHTML = `<p style="color: red;">Error: Could not load data for ${model}-${exp}.</p>`;
			}
		}
	}
}

function getStats(audioValues, textValues) {
	console.log("getStats");

	const f = d3.format(".2f")

	const maxAudio = f(d3.max(audioValues));
	const maxText = f(d3.max(textValues));
	const minAudio = f(d3.min(audioValues));
	const minText = f(d3.min(textValues));
	const medianAudio = f(d3.median(audioValues));
	const medianText = f(d3.median(textValues));

	return {maxAudio: maxAudio, minAudio: minAudio, medianAudio: medianAudio, maxText: maxText, minText: minText, medianText: medianText};
};

// --- Initial page setup and event listeners ---
function initPage() {
	// Initial draw
	drawAllVisualizations();

	// Add a debounced resize listener to redraw everything when the window changes size
	window.addEventListener('resize', debounce(drawAllVisualizations, 250));

	const audioPlayer = document.getElementById('audio-player');
	audioPlayer.addEventListener('timeupdate', () => {
		const currentTime = audioPlayer.currentTime;
		if (window.updatePlayheads && window.updatePlayheads.length > 0) {
			window.updatePlayheads.forEach(updateFunc => {
				updateFunc(currentTime);
			});
		}
	});

	audioPlayer.addEventListener('ended', hideAllPlayheads);
}

function hideAllPlayheads() {
	if (window.updatePlayheads && window.updatePlayheads.length > 0) {
		window.updatePlayheads.forEach(updateFunc => {
			updateFunc(-1);
		});
	}
}

initPage();
