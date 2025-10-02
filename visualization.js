// Store the update functions for each visualization's playhead.
window.updatePlayheads = [];

/**
 * Main function to generate the modality contribution visualization.
 * @param {object} config - The configuration object for the visualization.
 * @param {string} config.questionContainerId - ID of the div for the text visualization.
 * @param {string} config.audioContainerId - ID of the div for the audio visualization (SVG).
 * @param {string[]} config.question_tokens - Array of token strings.
 * @param {number[]} config.question_shapley_values - Shapley values corresponding to each token.
 * @param {number[]} config.audio_signal - The raw audio waveform data.
 * @param {number[]} config.audio_shapley_values - Shapley values for the audio.
 * @param {number} config.sample_rate - The sample rate of the audio signal.
 * @param {number} config.total_duration - The total duration of the audio in seconds.
 * @param {number} config.num_shapley_samples - The number of Shapley samples for the audio.
 * @param {number} config.intensity_threshold - A value between 0 and 1 to control highlighting.
 * @param {function} [config.onTokenClick] - Optional callback function for when a text token is clicked. Receives (token, index).
 * @param {number} [config.gt_start] - Optional ground truth start time in seconds.
 * @param {number} [config.gt_end] - Optional ground truth end time in seconds.
 */
function createModalityVisualization(config) {

	const {
		questionContainerId,
		answerContainerId,
		audioContainerId,
		question_tokens,
		question_shapley_values,
		audio_signal,
		audio_shapley_values,
		answer_tokens,
		sample_rate,
		total_duration,
		num_shapley_samples,
		onTokenClick,
		gt_start,
		gt_end,
		highlightedTokenIndex,
		initialPlayheadTime,
		totalWidth = 1000,
		totalHeight = 500
	} = config;

	// Clear previous visualizations
	d3.select(`#${questionContainerId}`).html("");
	d3.select(`#${answerContainerId}`).html("");
	d3.select(`#${audioContainerId}`).html("");

	const colormap = d3.interpolateGreys;

	const margin = { top: 10, right: 80, bottom: 40, left: 80 };
	const width = totalWidth - margin.left - margin.right;
	const height = totalHeight - margin.top - margin.bottom;
	// FIXME: this should be a user event
	const intensity_threshold = 0.8

	const heightRatios = [1, 1, 1, 1];
	const totalRatio = d3.sum(heightRatios);
	const plotHeights = heightRatios.map(r => (height / totalRatio) * r);
	const plotPads = 15;

	// --- 2. CREATE SCALES ---
	const maxTextShapley = d3.max(question_shapley_values, d => Math.abs(d));
	const maxAudioShapley = d3.max(audio_shapley_values, d => Math.abs(d));
	const max_abs_value = Math.max(maxTextShapley, maxAudioShapley);

	const colorScale = d3.scaleSequential(colormap).domain([0, max_abs_value * 1.1]);
	const xScale = d3.scaleLinear().domain([0, total_duration]).range([0, width]);

	const playheadId = `${audioContainerId}-playhead`;
	const updateThisPlayhead = (currentTime) => {
		const xPos = xScale(currentTime);
		// Only update if the playhead is within the visible area
		if (xPos >= 0 && xPos <= width) {
			d3.select(`#${playheadId}`)
				.attr("transform", `translate(${xPos}, 0)`)
				.style("visibility", "visible");
		} else {
			d3.select(`#${playheadId}`).style("visibility", "hidden");
		}
	};
	window.updatePlayheads.push(updateThisPlayhead);

	// --- 3. RENDER VISUALIZATIONS ---
	renderQuestionViz(questionContainerId, question_tokens, question_shapley_values, colorScale, maxTextShapley, intensity_threshold);
	renderAnswerViz(answerContainerId, answer_tokens, onTokenClick, highlightedTokenIndex);

	const svg = setupSvg(audioContainerId, totalWidth, totalHeight, margin);

	renderAudioViz(svg, {
		audio_signal, audio_shapley_values, sample_rate, total_duration,
		num_shapley_samples, gt_start, gt_end, xScale, colorScale,
		width, plotHeights, plotPads, max_abs_value,
		playheadId, initialPlayheadTime
	});

	if (typeof initialPlayheadTime === 'number') {
		updateThisPlayhead(initialPlayheadTime);
	}

}

/**
 * Sets up the main SVG container.
 * @param {string} containerId - The ID of the container div.
 * @param {number} totalWidth - The total width of the SVG element.
 * @param {number} totalHeight - The total height of the SVG element.
 * @param {object} margin - An object with top, right, bottom, left margins.
 * @returns {d3.Selection} The d3 selection for the main group element.
 */
function setupSvg(containerId, totalWidth, totalHeight, margin) {
	return d3.select(`#${containerId}`)
		.append("svg")
		.attr("width", totalWidth)
		.attr("height", totalHeight)
		.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);
}

/**
 * Renders the highlighted text tokens.
 * @param {string} containerId - The ID of the container div for the text.
 * @param {string[]} tokens - The array of text tokens.
 * @param {number[]} shapleyValues - The array of Shapley values for the text.
 * @param {d3.ScaleSequential} colorScale - The color scale for highlighting.
 * @param {number} maxShapley - The maximum absolute Shapley value for text.
 * @param {number} threshold - The intensity threshold for highlighting.
 */
function renderQuestionViz(containerId, tokens, shapleyValues, colorScale, maxShapley, threshold) {
	const textContainer = d3.select(`#${containerId}`);
	const textThreshold = threshold * maxShapley;

	console.log("renderQuestionViz");

	textContainer.append("h2").text("Question:")

	tokens.forEach((token, i) => {
		const value = shapleyValues[i];
		const absValue = Math.abs(value);

		const span = textContainer.append("span").text(token + " ");

		if (absValue > textThreshold) {
			const color = colorScale(absValue);
			span.style("background-color", color);
			const L = 0.299 * d3.color(color).r + 0.587 * d3.color(color).g + 0.114 * d3.color(color).b;
			if (L < 140) {
				span.style("color", "white");
			}
		}
		span.classed("token", true);
	});
}

// renderAnswerViz(answerContainerId, answer_tokens, onTokenClick);
function renderAnswerViz(containerId, tokens, onTokenClick, highlightedIndex) {
	const textContainer = d3.select(`#${containerId}`);

	textContainer.append("h2").text("Model answer:")

	tokens.forEach((token, i) => {
		const span = textContainer.append("span").text(token + " ");

		if (onTokenClick) {
			span.style("cursor", "pointer")
				.on("click", () => onTokenClick(token, i));
		}
		if (i === highlightedIndex) {
			span.classed("highlighted-token", true);
		}
		span.classed("token", true);
	});
}


/**
 * Renders all audio-related plots (waveform and heatmaps) and axes.
 * @param {d3.Selection} svg - The main SVG group to draw in.
 * @param {object} config - Configuration object for audio plots.
 */
function renderAudioViz(svg, config) {
	const {
		audio_signal, audio_shapley_values, sample_rate, total_duration,
		num_shapley_samples, gt_start, gt_end, xScale, colorScale,
		width, plotHeights, plotPads, max_abs_value, playheadId, initialPlayheadTime
	} = config;

	console.log("audio_shapley_values", audio_shapley_values);
	let currentY = 0;

	// Plot 1: Waveform
	const signalGroup = svg.append("g").attr("transform", `translate(0, ${currentY})`);
	const yScaleSignal = d3.scaleLinear().domain(d3.extent(audio_signal)).range([plotHeights[0], 0]);

	const line = d3.line()
		.x((_, i) => xScale(i / sample_rate))
		.y(d => yScaleSignal(d));

	signalGroup.append("path")
		.datum(audio_signal)
		.attr("fill", "none")
		.attr("stroke", "gray")
		.attr("stroke-width", 0.7)
		.attr("opacity", 0.8)
		.attr("d", line);

	// transparent rectangle that will capture click events on the waveform
	signalGroup.append("rect")
        .attr("width", width)
        .attr("height", plotHeights[0])
        .style("fill", "transparent")
        .style("cursor", "pointer")
        .on("click", (event) => {
            // Get the x-coordinate of the click relative to the signalGroup
            const xPos = d3.pointer(event, signalGroup.node())[0];

            // Use the inverse of the xScale to convert the pixel position back to a time value
            const clickedTime = xScale.invert(xPos);

            // Get the global audio player and update its currentTime
            const audioPlayer = document.getElementById('audio-player');
            if (audioPlayer) {
                audioPlayer.currentTime = clickedTime;
            }
        });

	const playhead = signalGroup.append("line")
		.attr("id", playheadId)
		.attr("class", "playhead")
		.attr("y1", 0)
		.attr("y2", plotHeights[0]) // Make it the full height of the waveform plot
		.attr("stroke", "red")
		.attr("stroke-width", 1.5)
		.style("visibility", "hidden") // Initially hidden
		.attr("transform", "translate(0, 0)"); // Start at time 0

	// Immediately position the playhead on initial render if time is provided.
	// This makes it appear instantly in the right spot.
	if (typeof initialPlayheadTime === 'number') {
		const xPos = xScale(initialPlayheadTime);
		if (xPos >= 0 && xPos <= width) {
			playhead.attr("transform",
				`translate(${xPos}, 0)`)
				.style("visibility",
					"visible");
		}
	}

	currentY += plotHeights[0] + plotPads;
	if (gt_start !== undefined && gt_end !== undefined) {
		signalGroup.append("rect")
			.attr("x", xScale(gt_start))
			.attr("width", xScale(gt_end) - xScale(gt_start))
			.attr("y", 0)
			.attr("height", plotHeights[0])
			.attr("fill", "red")
			.attr("opacity", 0.3);
	}

	// Plots 2, 3, 4: Heatmaps
	const shapleyData = [
		{ label: "Absolute\nValue", values: audio_shapley_values.map(d => Math.abs(d)) },
		{ label: "Positive\nOnly", values: audio_shapley_values.map(d => Math.max(0, d)) },
		{ label: "Negative\nOnly", values: audio_shapley_values.map(d => Math.abs(Math.min(0, d))) }
	];

	shapleyData.forEach((data, index) => {
		const heatmapGroup = svg.append("g").attr("transform", `translate(0, ${currentY})`);
		const rectWidth = width / data.values.length;

		heatmapGroup.selectAll("rect")
			.data(data.values)
			.enter().append("rect")
			.attr("x", (_, i) => xScale(i * (total_duration / num_shapley_samples)))
			.attr("y", 0)
			.attr("width", rectWidth + 0.5)
			.attr("height", plotHeights[index + 1])
			.attr("fill", d => d > 0 ? colorScale(d) : '#FFFFFF');

		const labelLines = data.label.split('\n');
		labelLines.forEach((line, i) => {
			heatmapGroup.append("text")
				.attr("class", "y-axis-label")
				.attr("x", -10)
				.attr("y", plotHeights[index + 1] / 2 - (labelLines.length - 1) * 6 + i * 12)
				.text(line);
		});
		currentY += plotHeights[index + 1] + plotPads;
	});

	// --- Axes and Legend ---
	const xAxis = d3.axisBottom(xScale);
	svg.append("g")
		.attr("transform", `translate(0, ${currentY - plotPads})`)
		.call(xAxis);

	svg.append("text")
		.attr("text-anchor", "middle")
		.attr("x", width / 2)
		.attr("y", currentY + 20)
		.text("Time (seconds)")
		.style("font-size", "14px");

	renderColorbar(svg, { width, plotHeights, plotPads, max_abs_value, colormap: d3.interpolateGreys });
}

/**
 * Renders the colorbar legend.
 * @param {d3.Selection} svg - The main SVG group to draw in.
 * @param {object} config - Configuration object for the colorbar.
 */
function renderColorbar(svg, config) {
	const { width, plotHeights, plotPads, max_abs_value, colormap } = config;

	const colorbarGroup = svg.append("g")
		.attr("transform", `translate(${width + 20}, ${plotHeights[0] + plotPads})`);

	const colorbarHeight = d3.sum(plotHeights.slice(1)) + (plotPads * 2);

	const gradient = colorbarGroup.append("defs")
		.append("linearGradient")
		.attr("id", "gradient")
		.attr("x1", "0%").attr("x2", "0%")
		.attr("y1", "100%").attr("y2", "0%");

	gradient.selectAll("stop")
		.data(d3.range(0, 1.01, 0.1))
		.enter().append("stop")
		.attr("offset", d => `${d * 100}%`)
		.attr("stop-color", d => colormap(d));

	colorbarGroup.append("rect")
		.attr("width", 20)
		.attr("height", colorbarHeight)
		.style("fill", "url(#gradient)");

	const colorbarScale = d3.scaleLinear().domain([0, max_abs_value]).range([colorbarHeight, 0]);
	const colorbarAxis = d3.axisRight(colorbarScale).ticks(5);

	colorbarGroup.append("g").attr("transform", `translate(20, 0)`).call(colorbarAxis);

	colorbarGroup.append("text")
		.attr("transform", "rotate(-90)")
		.attr("x", -colorbarHeight / 2)
		.attr("y", 50)
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.text("Shapley Value Magnitude");
}
