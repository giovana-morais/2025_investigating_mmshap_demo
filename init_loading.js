const paramsStr = window.location.search;
const searchParams = new URLSearchParams(paramsStr);
const qid = searchParams.get("qid");
document.getElementById("qid").innerHTML = qid;

// load audio for the sample
document.getElementById("audio-player").innerHTML = `<source src="data/audio/${qid}.wav" type="audio/wav">`;

// --- Main function to initialize the demo page ---
async function initPage() {
    const models = ["qwen", "mu"];
    const exps = ["fs", "zs"];

    for (const model of models) {
        for (const exp of exps) {
            const mainContainer = document.getElementById(`${model}-${exp}-container`);
            const dataFile = `data/${qid}_${model}_${exp}.json`;

            const plotId = `${model}-${exp}-plot`;
            const questionContainerId = `${plotId}-question`;
            const answerContainerId = `${plotId}-answer`;
            const audioContainerId = `${plotId}-audio`;

            const plotContainer = document.createElement('div');
            plotContainer.className = 'plot-container';
            // --- NEW: Add a button to the HTML structure ---
            plotContainer.innerHTML = `
                <div class="plot-header">
                    <h3>${model}_${exp}</h3>
                    <button id="${plotId}-reset-button" class="reset-button">Reset View</button>
                </div>
                <div id="${questionContainerId}" class="question-container"></div>
                <div id="${answerContainerId}" class="answer-container"></div>
                <div id="${audioContainerId}"></div>
            `;
            mainContainer.appendChild(plotContainer);


            try {
                const data = await d3.json(dataFile);

                // --- Store original 2D matrices ---
                const original_question_shapley = Array.isArray(data.question_shapley_values[0]) ? data.question_shapley_values : null;
                const original_audio_shapley = Array.isArray(data.audio_shapley_values[0]) ? data.audio_shapley_values : null;

                // --- Calculate and store the aggregated (default) data ---
                const aggregated_question_shapley = original_question_shapley ? original_question_shapley.map(d => d3.sum(d)) : data.question_shapley_values;
                const aggregated_audio_shapley = original_audio_shapley ? original_audio_shapley.map(d => d3.sum(d)) : data.audio_shapley_values;


                // --- Define the click handler for individual tokens ---
                const handleTokenClick = (answer_token, i) => {
                    if (!original_question_shapley || !original_audio_shapley) return;

                    const perTokenConfig = {
                        ...data,
                        questionContainerId,
                        answerContainerId,
                        audioContainerId,
                        onTokenClick: handleTokenClick,
                        question_shapley_values: d3.transpose(original_question_shapley)[i],
                        audio_shapley_values: d3.transpose(original_audio_shapley)[i],
                        highlightedTokenIndex: i
                    };
                    createModalityVisualization(perTokenConfig);
                };

                const handleResetClick = () => {
                    console.log(`Resetting view for ${model}-${exp}`);
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
                        highlightedTokenIndex: null
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
                    audio_shapley_values: aggregated_audio_shapley
                };

                // Create the initial visualization
                createModalityVisualization(vizConfig);

            } catch (error) {
                console.error(`Failed to load data file: ${dataFile}`, error);
                mainContainer.innerHTML = `<p style="color: red;">Error: Could not load data for ${model}-${exp}.</p>`;
            }
        }
    }
}

// Start the page initialization process
initPage();
