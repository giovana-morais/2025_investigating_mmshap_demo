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

// --- Helper function to get and format statistics from data arrays ---
function getStats(audioValues, textValues) {
    const f = d3.format(".2f");

    const maxAudio = f(d3.max(audioValues));
    const maxText = f(d3.max(textValues));
    const minAudio = f(d3.min(audioValues));
    const minText = f(d3.min(textValues));
    const medianAudio = f(d3.median(audioValues));
    const medianText = f(d3.median(textValues));

    return { maxAudio, minAudio, medianAudio, maxText, minText, medianText };
}

// --- Main function to initialize and draw the toy example visualization ---
async function drawToyExampleVisualization() {
    // Initialize a global array for playhead updaters if it doesn't exist
    if (!window.updatePlayheads) {
        window.updatePlayheads = [];
    }
    // Clear the array on each redraw to avoid duplicate listeners
    window.updatePlayheads = [];

    const mainContainer = document.getElementById('toy-example-container');
    if (!mainContainer) {
        console.error('Error: The container with id "toy-example-container" was not found.');
        return;
    }
    // Clear any previous visualizations in the container
    mainContainer.innerHTML = '';

    const plotId = 'toy-example-plot';
    const dataFile = `data/9999_qwen_toy.json`;

    const questionContainerId = `${plotId}-question`;
    const answerContainerId = `${plotId}-answer`;
    const audioContainerId = `${plotId}-audio`;

    const plotContainer = document.createElement('div');
    plotContainer.className = 'plot-container';
    plotContainer.id = `${plotId}-wrapper`;

    // Create the HTML structure for the plot inside the container
    plotContainer.innerHTML = `
        <h3 style="text-align:center;">Qwen-Audio MC-PI</h3>
        <div class="plot-header">
            <p id="${plotId}-current-view">Current viewing aggregate values</p>
            <button id="${plotId}-reset-button" class="reset-button">Reset View</button>
        </div>
        <table id="${plotId}-stats">
            <tr> <td></td> <td>min</td> <td>max</td> <td>median</td> </tr>
            <tr id="${plotId}-audio-stats">
                <td>Audio</td> <td></td> <td></td> <td></td>
            </tr>
            <tr id="${plotId}-question-stats">
                <td>Text</td> <td></td> <td></td> <td></td>
            </tr>
        </table>
        <div id="${plotId}-question" class="question-container"></div>
        <div id="${plotId}-answer" class="answer-container"></div>
        <div id="${plotId}-audio"></div>
    `;
    mainContainer.appendChild(plotContainer);

    try {
        const containerWidth = mainContainer.clientWidth;
        // Adjust width for padding/margins
        const vizWidth = containerWidth > 40 ? containerWidth - 40 : containerWidth;
        const vizHeight = 300;

        const data = await d3.json(dataFile);

        // --- Process Data ---
        const original_question_shapley = Array.isArray(data.question_shapley_values[0]) ? data.question_shapley_values : null;
        const original_audio_shapley = Array.isArray(data.audio_shapley_values[0]) ? data.audio_shapley_values : null;

        const aggregated_question_shapley = original_question_shapley ? original_question_shapley.map(d => d3.sum(d)) : data.question_shapley_values;
        const aggregated_audio_shapley = original_audio_shapley ? original_audio_shapley.map(d => d3.sum(d)) : data.audio_shapley_values;

        // Find the specific audio player for this section
        const audioPlayer = document.querySelector('#sec_summary .player');
        if (!audioPlayer) {
            console.error("Toy example audio player not found.");
            return;
        }

        // --- Define Event Handlers ---
        const handleTokenClick = (answer_token, i) => {
            if (!original_question_shapley || !original_audio_shapley) return;

            const currentTime = audioPlayer.currentTime;

            // Update plot header and stats table for the selected token
            document.getElementById(`${plotId}-current-view`).innerHTML = `Current viewing results for token: <b>${answer_token}</b>`;
            const { maxAudio, minAudio, medianAudio, maxText, minText, medianText } = getStats(d3.transpose(original_audio_shapley)[i], d3.transpose(original_question_shapley)[i]);
            document.getElementById(`${plotId}-audio-stats`).innerHTML = `<td>Audio</td> <td>${minAudio}</td> <td>${maxAudio}</td><td>${medianAudio}</td>`;
            document.getElementById(`${plotId}-question-stats`).innerHTML = `<td>Text</td> <td>${minText}</td> <td>${maxText}</td><td>${medianText}</td>`;

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
            // Reset plot header and stats table to the aggregate view
            document.getElementById(`${plotId}-current-view`).innerHTML = "Current viewing aggregate values";
            const { maxAudio, minAudio, medianAudio, maxText, minText, medianText } = getStats(aggregated_audio_shapley, aggregated_question_shapley);
            document.getElementById(`${plotId}-audio-stats`).innerHTML = `<td>Audio</td> <td>${minAudio}</td> <td>${maxAudio}</td><td>${medianAudio}</td>`;
            document.getElementById(`${plotId}-question-stats`).innerHTML = `<td>Text</td> <td>${minText}</td> <td>${maxText}</td><td>${medianText}</td>`;

            const currentTime = audioPlayer.currentTime;
            const defaultConfig = {
                ...data,
                questionContainerId,
                answerContainerId,
                audioContainerId,
                onTokenClick: handleTokenClick,
                question_shapley_values: aggregated_question_shapley,
                audio_shapley_values: aggregated_audio_shapley,
                highlightedTokenIndex: null,
                initialPlayheadTime: currentTime,
                totalWidth: vizWidth,
                totalHeight: vizHeight
            };
            createModalityVisualization(defaultConfig);
        };

        // --- Initial Draw ---
        document.getElementById(`${plotId}-reset-button`).addEventListener('click', handleResetClick);

        // Set initial stats for the aggregate view
        const { maxAudio, minAudio, medianAudio, maxText, minText, medianText } = getStats(aggregated_audio_shapley, aggregated_question_shapley);
        document.getElementById(`${plotId}-audio-stats`).innerHTML = `<td>Audio</td> <td>${minAudio}</td> <td>${maxAudio}</td><td>${medianAudio}</td>`;
        document.getElementById(`${plotId}-question-stats`).innerHTML = `<td>Text</td> <td>${minText}</td> <td>${maxText}</td><td>${medianText}</td>`;

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

        // This function is expected to be available globally from 'visualization.js'
        createModalityVisualization(vizConfig);

    } catch (error) {
        console.error(`Failed to load or process data file: ${dataFile}`, error);
        mainContainer.innerHTML = `<p style="color: red;">Error: Could not load visualization for the toy example. Make sure 'data/toy_example.json' exists.</p>`;
    }
}

// --- Initial page setup and event listeners ---
function initPage() {
    // Initial draw of the visualization
    drawToyExampleVisualization();

    // Add a debounced resize listener to redraw when the window changes size
    window.addEventListener('resize', debounce(drawToyExampleVisualization, 250));

    // Get the specific audio player for the toy example
    const audioPlayer = document.getElementById("toy-example-player");
    if (!audioPlayer) return;

    // This listener updates the playhead in the visualization as the audio plays
    audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = audioPlayer.currentTime;
        if (window.updatePlayheads && window.updatePlayheads.length > 0) {
            window.updatePlayheads.forEach(updateFunc => {
                updateFunc(currentTime);
            });
        }
    });

    const hidePlayhead = () => {
        if (window.updatePlayheads && window.updatePlayheads.length > 0) {
            window.updatePlayheads.forEach(updateFunc => {
                // Use -1 or another out-of-bounds value to hide the playhead
                updateFunc(-1);
            });
        }
    }

    // Hide the playhead when the audio ends or is paused
    audioPlayer.addEventListener('ended', hidePlayhead);
    audioPlayer.addEventListener('pause', hidePlayhead);
}

// Run the setup when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initPage);
