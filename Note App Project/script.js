window.addEventListener('load', function() {
  // Code to execute after the full page loads


const year = document.getElementById('year');
const month = document.getElementById('month');
const day = document.getElementById('day');
const description = document.getElementById('description');
const dateDisplay = document.getElementById('date-display');
const notesContainer = document.getElementById('notes-container');

let dayValue, weekValue, monthValue;
let dateString = "";

console.log(moment().calendar());

var date = [];
updateDate (-1, -1, -1);
displayNotes();

function updateDate(d,m,y) {
    if (d !== -1) {
        date[0] = d;
    }else if (d == -2){
        date[0] = moment().date();
    };
    if (m !== -1) {
        date[1] = m;
    }else if (m == -2){
        date[1] = moment().month() + 1; // moment months are 0-indexed
    }
    if (y !== -1) {
        date[2] = y;
    }else if (y == -2){
        date[2] = moment().year();
    }
    console.log(date);
    displayDate();
}

function detectFillTypeDay(value) {
    //detectFillTypeDay.value => 5 (day of week value)
    const trimmed = value.trim().toUpperCase(); // Normalize input for easier matching
    const daysOfWeek = { MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6, SUNDAY: 0, MON: 1, TUE: 2, TUES:2, WED: 3, THU: 4, FRI: 5, SAT: 6, SUN: 0, M: 1, T: 2, W: 3, TH: 4, F: 5, S: 6, SU: 0};


    if (!isNaN(trimmed) && trimmed !== '') {
    // Return day number
        return {
            type: 'number',
            value: parseInt(trimmed, 10) // usable with moment().date(value)
        };
    } else if (daysOfWeek[trimmed] !== undefined) {
    // Calculate next occurrence of that weekday
        return {
            type: 'weekday',
            value: daysOfWeek[trimmed]
        };
    } else if (trimmed =='X') {
        return {
            type: 'noinput',
            value: null
        };
    }
    
    // Default return for invalid input
    return {
        type: 'invalid',
        value: null
    };
}   

/*
1 letter -> enter then check: m t w th f s su
mon, tue, wed, thu, fri, sat, sun
3 letters - check
1 number -> enter then check: 5
2 numbers - check 2 types: 05, 16

Next week
NM => next monday
NMON => next monday
Next Monday => next monday
nextmonday => next monday
*/

description.addEventListener('keyup', () => {
    if (event.key === 'Tab') {
        day.focus();
    }
});

day.addEventListener('keyup', (event) => {
    let result = -1;
    //1
    if (event.key == 'x' || event.key == 'X') {
        console.log('No input for day, defaulting to current day');
        event.preventDefault(); // prevent 'x' from being entered in the input
        updateDate(moment().date(), moment().month()+1, moment().year());
        storeNote(description.value, `${moment().date()}/${moment().month()+1}/${moment().year()}`);
    }else if(day.value.toUpperCase().startsWith('N')){
        console.log("starts with N");
        //set to next week
        if(day.value.length == 4){
            let weekDay = day.value.slice(1,4);

            result = detectFillTypeDay(weekDay);
            //check if invalid
            if (result.type == 'invalid'){
                displayInvalid();
            }else{
                console.log("date happened this week, stay the same");
                updateDate(getDateOfWeekdayNextWeek(result.value)[0], getDateOfWeekdayNextWeek(result.value)[1], getDateOfWeekdayNextWeek(result.value)[2]);
                storeNote(description.value, `${getDateOfWeekdayNextWeek(result.value)[0]}/${getDateOfWeekdayNextWeek(result.value)[1]}/${getDateOfWeekdayNextWeek(result.value)[2]}`);
                //add next step
            }
        };
    
    }else if(day.value.length == 3 && /^[a-zA-Z]{3}$/.test(day.value)){
        //eg MON TUE
        result = detectFillTypeDay(day.value);
        if (result.type == 'invalid'){
            displayInvalid();
        }else{
            updateDate(getNextWeekdayDate(result.value)[0], getNextWeekdayDate(result.value)[1]+1, getNextWeekdayDate(result.value)[2]);
        };
    }else if (/^\d+$/.test(day.value) && day.value.length == 2) {
        //eg 05, 16
        updateDate(number(day.value), -1, -1);
        month.focus();
    //}else if (/^\d+$/.test(day.value) && day.value.length == 1) {
    }else if (event.key === 'Enter') {
        result = detectFillTypeDay(day.value);
        if (result.type === 'number') {
            console.log(result.value);
            date[0]=result.value;
            updateDate(day.value, -1, -1);
            month.focus();
        } else if (result.type === 'weekday') {
            console.log(result.value);
            //add function to figure out the date
            updateDate(getNextWeekdayDate(result.value)[0], getNextWeekdayDate(result.value)[1]+1, getNextWeekdayDate(result.value)[2]);
            //add next step
        } else if (result.type === 'invalid') {
            displayInvalid();
        }
    }
    
});

month.addEventListener('keydown', () => {
    let result = -1;
        if (event.key === 'Enter' && month.value == '') {
            console.log ('Defualt to current month');
            result = moment().month() + 1; // moment months are 0-indexed
            year.focus();
            console.log(result);
        }else if (event.key === 'Enter' && month.value !== '') {
            result = parseInt(month.value, 10);
            date[1] = result;
            console.log(result);
            year.focus();
        }else if (event.key === 'X') {
            updateDate(-1, moment().month() + 1, -1);
            year.focus();
        }
});

year.addEventListener('keydown', () => {
    if (event.key === 'Enter') {
        updateDate(-1, -1, parseInt(year.value, 10));
        storeNote(description.value, `${date[0]}/${date[1]}/${date[2]}`);
    }
    //add next step
});

function getNextWeekdayDate(dayNo) {
    const today = new Date();
    const todayIndex = today.getDay(); // 0 = Sunday, 6 = Saturday

    const targetIndex = dayNo;
    if (targetIndex === -1) {
        return null; // invalid day name
    };

    let isNextWeek = false;
    // Calculate how many days until next occurrence
    let daysUntil = targetIndex - todayIndex;
    if (daysUntil <= 0) {
        daysUntil += 7; // next week if today has passed or is today
        isNextWeek = true;
    }

    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntil);

    return [nextDate.getDate(), nextDate.getMonth(), nextDate.getFullYear(), isNextWeek]; // returns day number (1-31), month (0-11), year, and next week flag
};

function displayDate() {
    
    console.log(date);
    const dateString = `${date[0]}/${date[1]}/${date[2]}`;
    dateDisplay.textContent = dateString;
};

function displayInvalid() {
    dateDisplay.textContent = "Invalid input. Please enter a valid day.";
};

function getDateOfWeekdayNextWeek(dayNumber) {
    const today = new Date();

    const currentJS = today.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday

    let diff;

    if (dayNumber === 0) {
        // Sunday: jump to the Sunday in the week after next
        diff = 7 - currentJS + 7; // 7 days to end of this week + 7 days to next Sunday
    } else {
        // Other weekdays: next occurrence
        diff = dayNumber - currentJS;
        if (diff <= 0) {
            diff += 7; // always move to next week if today is the same or passed
        }
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    return [
        targetDate.getDate(),
        targetDate.getMonth() + 1,
        targetDate.getFullYear()
    ];
}

function storeNote(noteDescription, noteDate) {
    // Retrieve existing notes from localStorage or initialize empty array
    let notes = JSON.parse(localStorage.getItem('notes')) || [];
    
    // Create note object with description and date
    const note = {
        description: noteDescription,
        date: noteDate,
        createdAt: new Date().toISOString()
    };
    
    // Add note to array and save back to localStorage
    notes.push(note);
    localStorage.setItem('notes', JSON.stringify(notes));
    
    console.log('Note stored:', note);
    
    // Clear input fields
    description.value = '';
    day.value = '';
    month.value = '';
    year.value = '';
    
    // Display all notes
    displayNotes();
}

function displayNotes() {
    // Retrieve notes from localStorage
    let notes = JSON.parse(localStorage.getItem('notes')) || [];
    
    // Clear the container
    notesContainer.innerHTML = '';
    
    // If no notes, display a message
    if (notes.length === 0) {
        notesContainer.innerHTML = '<p>No notes yet</p>';
        return;
    }
    
    // Create a heading
    const heading = document.createElement('h3');
    heading.textContent = 'Stored Notes';
    notesContainer.appendChild(heading);
    
    // Create a list to display notes
    const notesList = document.createElement('ul');
    
    notes.forEach((note, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${note.date}: ${note.description}`;
        notesList.appendChild(listItem);
    });
    
    notesContainer.appendChild(notesList);
}

});

function clearAllNotes() {
    // Retrieve notes container
    const notesContainer = document.getElementById('notes-container');
    
    // Clear localStorage
    localStorage.removeItem('notes');
    
    // Clear the container
    notesContainer.innerHTML = '<p>No notes yet</p>';
    
    console.log('All notes cleared');
}

// description first then the date
// implement arrow keys to indicate next week
//same date input