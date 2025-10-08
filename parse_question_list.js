// This function runs automatically when the page content has finished loading
document.addEventListener('DOMContentLoaded', function() {
    // Call the main function and tell it where to find the JSON file
    populateExamples('examples.json');
});

/**
 * Fetches example data from a JSON file and populates the HTML lists.
 * @param {string} jsonFilePath The path to the JSON file.
 */
async function populateExamples(jsonFilePath) {
    try {
        // Fetch the data from the JSON file
        const response = await fetch(jsonFilePath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const examples = await response.json();

        // Get the container elements from the HTML
        const sseListContainer = document.getElementById('sse_list');
        const randomListContainer = document.getElementById('random_list');

        // Clear any existing placeholder content
        sseListContainer.innerHTML = '';
        randomListContainer.innerHTML = '';

        // Loop through each example in the JSON data
        examples.forEach(example => {
            // Create a new <div> for this example item
            const itemDiv = document.createElement('div');
            itemDiv.className = 'example_item';

            // Create the HTML content for the item
            // This includes the link and the audio player
            itemDiv.innerHTML = `
                <a href="comparison.html?qid=${example.qid}">${example.prompt}</a>
                <br>
                <audio controls class="player">
                    <source src="${example.audio_path}" type="audio/wav">
                    Your browser does not support the audio element.
                </audio>
            `;

            // Decide which list to add the new item to
            if (example.question_type === 'sse') {
                sseListContainer.appendChild(itemDiv);
            } else if (example.question_type === 'random') {
                randomListContainer.appendChild(itemDiv);
            }
        });

    } catch (error) {
        console.error("Could not fetch or process the examples:", error);
    }
}
