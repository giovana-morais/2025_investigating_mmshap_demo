const paramsStr = window.location.search;
const searchParams = new URLSearchParams(paramsStr);
const qid = searchParams.get("qid");
document.getElementById("qid").innerHTML = `track id should come here instead of qid = ${qid}`;

// load audio for the sample based on the qid provided
document.getElementById("audio-player").innerHTML = `<source src="data/audio/${qid}.wav" type="audio/wav">`;

// --- Main function to initialize the demo page ---
async function initPage() {
	if (window.updatePlayheads) {
		window.updatePlayheads = [];
	}
	const models = ["qwen", "mu"];
	const exps = ["fs", "zs"];

	// browser builds the entire grid
	for (const model of models) {
		for (const exp of exps) {
			console.log(`processing data for ${model}-${exp}`);

			const mainContainer = document.getElementById(`${model}-${exp}-container`);
			const plotId = `${model}-${exp}-plot`;
			const dataFile = `data/${qid}_${model}_${exp}.json`;

			const questionContainerId = `${plotId}-question`;
			const answerContainerId = `${plotId}-answer`;
			const audioContainerId = `${plotId}-audio`;

			const plotContainer = document.createElement('div');

			plotContainer.className = 'plot-container';
			plotContainer.id = `${plotId}-wrapper`;
			plotContainer.innerHTML = `
				<div class="plot-header">
					<h3>${model}_${exp}</h3>
					<button id="${plotId}-reset-button" class="reset-button">Reset View</button>
				</div>
				<div id="${plotId}-question" class="question-container"></div>
				<div id="${plotId}-answer" class="answer-container"></div>
				<div id="${plotId}-audio"></div>
			`;
			mainContainer.appendChild(plotContainer);


			try {
				const vizWidth = 500;
				const vizHeight = 300;
				console.log("vizWidth", vizWidth);
				console.log("plotContainer.clientWidth", plotContainer.clientWidth);

				const data = await d3.json(dataFile);

				// store original 2d matrices so we can go back and forth between viz
				// types
				const original_question_shapley = Array.isArray(data.question_shapley_values[0]) ? data.question_shapley_values : null;
				const original_audio_shapley = Array.isArray(data.audio_shapley_values[0]) ? data.audio_shapley_values : null;

				// store the aggregated (default) data
				const aggregated_question_shapley = original_question_shapley ? original_question_shapley.map(d => d3.sum(d)) : data.question_shapley_values;
				const aggregated_audio_shapley = original_audio_shapley ? original_audio_shapley.map(d => d3.sum(d)) : data.audio_shapley_values;

				// --- Define the click handler for individual tokens ---
				const handleTokenClick = (answer_token, i) => {
					if (!original_question_shapley || !original_audio_shapley) return;

					const currentTime = document.getElementById('audio-player').currentTime;

					const perTokenConfig = {
						...data,
						questionContainerId,
						answerContainerId,
						audioContainerId,
						onTokenClick: handleTokenClick,
						question_shapley_values: d3.transpose(original_question_shapley)[i],
						audio_shapley_values: d3.transpose(original_audio_shapley)[i],
						highlightedTokenIndex: i,
						initialPlayheadTime: currentTime,
						totalWidth: vizWidth,
						totalHeight: vizHeight
					};
					createModalityVisualization(perTokenConfig);
				};

				const handleResetClick = () => {
					console.log(`Resetting view for ${model}-${exp}`);
					const currentTime = document.getElementById('audio-player').currentTime;
					const defaultConfig = {
						...data,
						questionContainerId,
						answerContainerId,
						audioContainerId,
						onTokenClick: handleTokenClick,
						// Use the stored aggregated values
						question_shapley_values: aggregated_question_shapley,
						audio_shapley_values: aggregated_audio_shapley,
						// Ensure no token is highlighted
						highlightedTokenIndex: null,
						initialPlayheadTime: currentTime,
						totalWidth: vizWidth,
						totalHeight: vizHeight
					};
					createModalityVisualization(defaultConfig);
				};

				// --- Attach the event listener to the reset button ---
				document.getElementById(`${plotId}-reset-button`).addEventListener('click', handleResetClick);

				// Prepare the configuration object for the initial plot
				const vizConfig = {
					...data,
					questionContainerId,
					answerContainerId,
					audioContainerId,
					onTokenClick: handleTokenClick,
					question_shapley_values: aggregated_question_shapley,
					audio_shapley_values: aggregated_audio_shapley,
					totalWidth: vizWidth,
					totalHeight: vizHeight
				};

				// Create the initial visualization
				createModalityVisualization(vizConfig);

			} catch (error) {
				console.error(`Failed to load data file: ${dataFile}`, error);
				mainContainer.innerHTML = `<p style="color: red;">Error: Could not load data for ${model}-${exp}.</p>`;
			}
		}
	}
	// }, 0);
}

initPage();
// Your JavaScript code here
const audioPlayer = document.getElementById('audio-player');

audioPlayer.addEventListener('timeupdate', () => {
	// Get the current time from the player
	const currentTime = audioPlayer.currentTime;

	// If our global array of update functions exists, loop through and call each one
	if (window.updatePlayheads && window.updatePlayheads.length > 0) {
		window.updatePlayheads.forEach(updateFunc => {
			updateFunc(currentTime);
		});
	}
});

// Make sure the playhead hides when the audio ends
audioPlayer.addEventListener('ended', hideAllPlayheads);

function hideAllPlayheads() {
	if (window.updatePlayheads && window.updatePlayheads.length > 0) {
		// We can just call the update functions with a time outside the range and
		// then it disappears
		window.updatePlayheads.forEach(updateFunc => {
			updateFunc(-1);
		});
	}
}
