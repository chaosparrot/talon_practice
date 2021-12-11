var changes = 0;
var editor = ace.edit("editor");
var exampleEditor = ace.edit("editor2");
exampleEditor.setReadOnly(true);
editor.on('change', function() {
	changes++;
});

var params = new URLSearchParams(window.location.search)
var competitiveMode = window.localStorage && window.localStorage.getItem("talon-practice-challengemode") == "true";
if (!competitiveMode) {
	document.getElementById("toggle-help").innerHTML = "Show help";
	document.getElementById("timer").style.display = 'none';	
}
	
function reset() {
	changes = 0;
}

function setCommandEnabled(editor, name, enabled) {
	var command = editor.commands.byName[name]
	if (!command.bindKeyOriginal) 
		command.bindKeyOriginal = command.bindKey
	command.bindKey = enabled ? command.bindKeyOriginal : null;
	editor.commands.addCommand(command);
	// special case for backspace and delete which will be called from
	// textarea if not handled by main commandb binding
	if (!enabled) {
		var key = command.bindKeyOriginal;
		if (key && typeof key == "object")
			key = key[editor.commands.platform];
		if (/backspace|delete/i.test(key))
			editor.commands.bindKey(key, "null")
	}
}

editor.on('focus', function() {
	setCommandEnabled(editor, "indent", true)
	setCommandEnabled(editor, "outdent", true)
});

editor.commands.addCommand({
	name: "escape",
	bindKey: {win: "Esc", mac: "Esc"},
	exec: function() {
		setCommandEnabled(editor, "indent", false)
		setCommandEnabled(editor, "outdent", false)
		document.getElementById("toggle-game").focus();		
	}
});

var currentLesson = null;

var formatTimer = function(distance) {
	var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
	if ( minutes < 10 ){
		minutes = "0" + minutes;
	}
	var seconds = Math.floor((distance % (1000 * 60)) / 1000);
	if ( seconds < 10 ){
		seconds = "0" + seconds;
	}
	var milliseconds = Math.floor((distance % 1000 / 100));
	return minutes + ":" + seconds + "." + milliseconds;
};

var getLessonScoreList = function(lesson) {
	var scoreList = [];
	
	if ( window.localStorage ) {
		var currentLeaderBoard = JSON.parse(window.localStorage.getItem("talon-practice-scoreboard"));
		if (!currentLeaderBoard ) {
			currentLeaderBoard = {};
		}
		
		if (!currentLeaderBoard.hasOwnProperty(lesson.title)){
			currentLeaderBoard[lesson.title] = [];
		}
		
		scoreList = currentLeaderBoard[lesson.title];
	}
	
	return scoreList.sort(function(a, b){
		if ( b.score == a.score ){
			return Math.sign(a.time - b.time);
		} else {
			return Math.sign(b.score - a.score);
		}
	});
}

var updateHighscores = function(lesson) {
	var scoreList = getLessonScoreList(lesson);
	var highScoreText = "";
	if (scoreList.length > 0) {
		highScoreText += "<table><thead><tr><th>Score</th><th>Time</th><th>Date</th></tr></thead><tbody>";
		
		scoreList.forEach(function(scoreRow){
			highScoreText += "<tr><td>" + scoreRow.score + "</td><td>" + formatTimer(scoreRow.time) + "</td><td>On today!</td></tr>";
		});
		highScoreText += "</tbody>";
	} else {
		highScoreText += "No existing scores found for " + lesson.title;
	}
	
	document.getElementById("highscore").innerHTML = highScoreText;	
};

var setLesson = function(lesson) {
	currentLesson = lesson;
	if ( !!currentLesson ) {
		exampleEditor.setValue(currentLesson.expectedContent, -1);
		document.getElementById("toggle-help").focus();
		
		updateHighscores(currentLesson);
	}
};

var startDateTime = new Date().getTime();	
var timerInterval = null;
var gameStarted = false;
var toggleGame = function() {
	helpShown = false;
	gameStarted = !gameStarted;
	if (timerInterval) {
		clearInterval(timerInterval);
	}
	
	if (gameStarted) {
		document.getElementById("help-sidebar").classList.remove('opened');
		document.getElementById("editor2").classList.remove('left');
		document.getElementById("editor").style.display = 'block';
		document.getElementById("close-lesson").style.display = 'none';		
		document.getElementById("after-game").classList.remove('opened');
		reset();
		document.getElementById("toggle-game").innerHTML = "Stop game";
		editor.setValue(currentLesson.startingContent);
		editor.focus();
		
		startDateTime = new Date().getTime();			
		timerInterval = setInterval(updateTimer, 100);
	} else {
		document.getElementById("editor").style.display = 'none';		
		document.getElementById("close-lesson").style.display = 'inline-block';			
		document.getElementById("help-sidebar").classList.remove('opened');
		document.getElementById("editor2").classList.add('left');
		document.getElementById("editor2").style.display = 'block';		
		document.getElementById("after-game").classList.add('opened');
		document.getElementById("toggle-help").innerHTML = 'Show help';

		document.getElementById("toggle-game").innerHTML = "Start game";
		var endDateTime = new Date().getTime();
		
		if ( competitiveMode ) {
			var score = currentLesson.startingScore;
			var levenshtein = compareStringEquality( editor.getValue(), currentLesson.expectedContent );
			var scoreExplanation = "Starting score: " + score + "<br/>";
			if ( levenshtein === 0 ) {
				scoreExplanation += "<strong>Perfect match!</strong> <span style=\"color: green;\">+" + score + "</span><br/>";
				score *= 2;
			} else {
				scoreExplanation += "Expected result not reached: <span style=\"color: red;\">-50</span> for each character difference (" + levenshtein + ")<br/>";			
				score -= levenshtein * 50;
			}
			
			if ( changes > currentLesson.expectedChanges ) {
				score -= ( changes - currentLesson.expectedChanges ) * 50;
				scoreExplanation += "You used more steps than neccesary: <span style=\"color: red;\">-50</span> for each extra step (" + ( changes - currentLesson.expectedChanges ) + ")<br/>";
			}
			
			var usedSeconds = Math.floor( endDateTime - startDateTime ) / 1000;
			if ( usedSeconds < currentLesson.expectedSeconds ) {
				scoreExplanation += "You used less time than expected! <span style=\"color: green;\">+25</span> for each second saved (" + Math.floor( currentLesson.expectedSeconds - usedSeconds ) + ")<br/>";
				score += Math.floor( currentLesson.expectedSeconds - usedSeconds ) * 25;
			}
			
			score = Math.max( 0, score );
			document.getElementById("calculated-score").innerHTML = 'Your score: <span class="primary">' + score + "</span>";
			document.getElementById("score-explanation").innerHTML = scoreExplanation;
			
			if ( window.localStorage ){
				var currentLeaderBoard = JSON.parse(window.localStorage.getItem("talon-practice-scoreboard"));
				if (!currentLeaderBoard ) {
					currentLeaderBoard = {};
				}
				
				if (!currentLeaderBoard.hasOwnProperty(currentLesson.title)){
					currentLeaderBoard[currentLesson.title] = [];
				}
				
				currentLeaderBoard[currentLesson.title].push({score: score, time: usedSeconds * 1000, perfect: levenshtein == 0, runAt: endDateTime});
				window.localStorage.setItem("talon-practice-scoreboard", JSON.stringify(currentLeaderBoard));
			}
			
			updateHighscores(currentLesson);		
		} else {
			document.getElementById("help-sidebar").classList.add('opened');
			document.getElementById("after-game").classList.remove('opened');			
		}
	}
}

var helpShown = true;
var toggleHelp = function() {
	helpShown = !helpShown;
	console.log( gameStarted, helpShown );
	
	if (competitiveMode) {
		if (helpShown) {
			document.getElementById("toggle-help").innerHTML = 'Show highscores';
			document.getElementById("help-sidebar").classList.add('opened');
			document.getElementById("after-game").classList.remove('opened');
		} else {
			document.getElementById("toggle-help").innerHTML = 'Show help';
			document.getElementById("help-sidebar").classList.remove('opened');
			document.getElementById("after-game").classList.add('opened');		
		}
	} else if (gameStarted) {
		if (helpShown) {
			document.getElementById("after-game").classList.add('opened');					
			document.getElementById("help-sidebar").classList.add('opened');
			document.getElementById("editor2").style.display = 'none';
			document.getElementById("toggle-help").innerHTML = 'Show goal';
		} else {
			document.getElementById("help-sidebar").classList.remove('opened');
			document.getElementById("after-game").classList.remove('opened');
			document.getElementById("editor2").style.display = 'block';
			document.getElementById("toggle-help").innerHTML = 'Show help';			
		}
	}
}

var updateTimer = function() {
	// Get today's date and time
	var now = new Date().getTime();

	// Find the distance between now and the count down date
	var distance = now - startDateTime;
	document.getElementById("timer").innerHTML = formatTimer(distance);
}

var compareStringEquality = function(a, b){
	if(a.length == 0) return b.length;
	if(b.length == 0) return a.length; 

	var matrix = [];

	// increment along the first column of each row
	var i;
	for(i = 0; i <= b.length; i++){
		matrix[i] = [i];
	}

	// increment each column in the first row
	var j;
	for(j = 0; j <= a.length; j++){
		matrix[0][j] = j;
	}

	// Fill in the rest of the matrix
	for(i = 1; i <= b.length; i++){
		for(j = 1; j <= a.length; j++){
			if(b.charAt(i-1) == a.charAt(j-1)){
				matrix[i][j] = matrix[i-1][j-1];
			} else {
				matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
				Math.min(matrix[i][j-1] + 1, // insertion
				matrix[i-1][j] + 1)); // deletion
			}
		}
	}

	return matrix[b.length][a.length];
};

var dynamicKeypress = function(event) {
	if (event.keyCode === 37 || event.keyCode === 39) {
		var lessonList = Array.prototype.slice.call( event.target.parentNode.children );
		var direction = event.keyCode === 37 ? -1 : 1;
		var nextElementIndex = lessonList.indexOf( event.target ) + direction;
		
		if (nextElementIndex > -1 && nextElementIndex < lessonList.length ) {
			lessonList[nextElementIndex].focus();
		}
	}
}