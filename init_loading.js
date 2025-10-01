const paramsStr = window.location.search;
const searchParams = new URLSearchParams(paramsStr);
const qid = searchParams.get("qid");
document.getElementById("qid").innerHTML = qid

// load audio for the sample
document.getElementById("audio-player").innerHTML = `<source src="data/audio/${qid}.wav" type="audio/wav">`

// --- Main function to initialize the demo page ---
async function initPage() {
	const models = ["qwen", "mu"];
	const exps = ["fs", "zs"];

	for (const model of models) {
		for (const exp of exps) {
			const mainContainer = document.getElementById(`${model}-${exp}-container`);
			const dataFile = `data/${qid}_${model}_${exp}.json`;

			const plotId = "plot";
			const questionContainerId = `${plotId}-question`;
			const answerContainerId = `${plotId}-answer`;
			const audioContainerId = `${plotId}-audio`;

			const plotContainer = document.createElement('div');
			plotContainer.className = 'plot-container';
			plotContainer.innerHTML = `
									<h3 id="${plotId}-title">Loading...</h3>
									<h3>${model}_${exp}</h3>
									<div id="${plotId}-question" class="question-container"></div>
									<div id="${plotId}-answer" class="answer-container"></div>
									<div id="${plotId}-audio"></div>
							`;
			mainContainer.appendChild(plotContainer);

			console.log("plotContainer added");


			try {
				const data = await fetch(dataFile).then(response => response.json());

				// Update the title from the loaded data
				const titleEl = document.getElementById(`${plotId}-title`);
				titleEl.innerText = data.title || `Single Example`;

				// Prepare the configuration object for the plot
				const vizConfig = {
					...data, // Spread all properties from the JSON file
					questionContainerId: questionContainerId,
					answerContainerId: answerContainerId,
					audioContainerId: audioContainerId,
					onTokenClick: (answer_token, i) => handleTokenClick(answer_token, i) // Optional
				};

				if (Array.isArray(vizConfig.question_shapley_values[0])) {
					console.log("Aggregating text shapley values for default viz");
					vizConfig.question_shapley_values = vizConfig.question_shapley_values.map(d => d3.sum(d));
				}

				if (Array.isArray(vizConfig.audio_shapley_values[0])) {
					console.log("Aggregating audio shapley values for default viz");
					vizConfig.audio_shapley_values = vizConfig.audio_shapley_values.map(d => d3.sum(d));
				}

				// Create the visualization with the processed data
				createModalityVisualization(vizConfig);

			} catch (error) {
				console.error("Failed to load data file:", error);
				mainContainer.innerHTML = `<p style="color: red;">Error: Could not load the visualization data.</p>`;
			}
		}
	}


}

function handleTokenClick(answer_token, i) {
	console.log("answer_token", answer_token);
	console.log("i", i);
}

// Start the page initialization process
initPage();
