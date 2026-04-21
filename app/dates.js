/* ─────────────────────────────── DATE FEATURE ─── */

// Get references to date input fields
const eDay = document.getElementById('eDay');
const eMonth = document.getElementById('eMonth');
const eYear = document.getElementById('eYear');

let date = []

// Convert day name to weekday number (Monday=1, Sunday=0)
function getDayNumber(dayName) {
  const days = {
    // Full names
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
    'friday': 5, 'saturday': 6, 'sunday': 0,
    // Abbreviations
    'mon': 1, 'tue': 2, 'wed': 3, 'thu': 4,
    'fri': 5, 'sat': 6, 'sun': 0
  };
  
  const normalized = dayName.toLowerCase().trim();
  return days[normalized] !== undefined ? days[normalized] : null;
}

// Get the next date for a given day number
function getNextDateForDay(dayNumber) {
  if (dayNumber === null || dayNumber === undefined) return;
  
  const today = new Date();
  const currentDay = today.getDay();
  
  // Convert JS getDay() (0=Sunday) to our format (0=Sunday, 1=Monday...6=Saturday)
  let daysUntil = dayNumber - currentDay;
  
  // If the day is today or has already passed, get next week's occurrence
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + daysUntil);
  
  // Update global date variable
  return [nextDate.getDate(), nextDate.getMonth() + 1, nextDate.getFullYear()];
  date[0] = nextDate.getDate();
  date[1] = nextDate.getMonth() + 1;  // getMonth() returns 0-11, so add 1
  date[2] = nextDate.getFullYear();
}

// Get the next next date for a given day number (two weeks ahead)
// Input: dayNumber (0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, etc.)
// Returns: [day, month, year] for the second occurrence of that weekday
// Example: If today is Tuesday and input is 3 (Wednesday), returns the Wednesday after next Wednesday
function getNextNextDateForDay(dayNumber) {
  if (dayNumber === null || dayNumber === undefined) return null;
  
  const today = new Date();
  const currentDay = today.getDay();
  
  // Calculate days until the target weekday
  let daysUntil = dayNumber - currentDay;
  
  // If the day is today or has already passed, get next week's occurrence
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  
  // Add 7 more days to get the second occurrence
  daysUntil += 7;
  
  const nextNextDate = new Date(today);
  nextNextDate.setDate(nextNextDate.getDate() + daysUntil);
  
  // Return the date as a list [day, month, year]
  return [
    nextNextDate.getDate(),
    nextNextDate.getMonth() + 1,  // getMonth() returns 0-11, so add 1 for 1-12
    nextNextDate.getFullYear()
  ];
}

// Update date input fields with the provided date array
// Input: dateArray [day, month, year] to associate with the current note being edited
// Updates the form fields: eDay, eMonth, eYear
// Integrates with app.js saveNote() to persist dates to note objects
function updateDate(dateArray) {
  if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
    console.warn('Invalid date array provided to updateDate');
    return;
  }
  
  const [day, month, year] = dateArray;
  
  // Update the date input fields with the provided values
  if (eDay) eDay.value = day || '';
  if (eMonth) eMonth.value = month || '';
  if (eYear) eYear.value = year || '';
  
  // Also update the global date variable for consistency
  date[0] = day;
  date[1] = month;
  date[2] = year;
}

// Format date array to display string: "weekday year/month/day"
// Input: dateArray [day, month, year]
// Returns: formatted string like "Friday 2026/4/19" or empty string if invalid
function formatDateDisplay(dateArray) {
  if (!dateArray || !Array.isArray(dateArray) || dateArray.length < 3) {
    return '';
  }

  const [day, month, year] = dateArray;

  // Validate date values
  if (!day || !month || !year) {
    return '';
  }

  // Create a Date object to get the weekday
  const dateObj = new Date(year, month - 1, day);
  
  // Array of weekday names
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekdayName = weekdays[dateObj.getDay()];

  // Format as "weekday year/month/day"
  return `${weekdayName} ${year}/${month}/${day}`;
}
let dayInputMode = null; // 'weekday', 'n-mode', 'number', or null

// Handle intelligent day input with shortcuts
function handleDayInput(event) {
  if (event.key === 'Enter') {
    saveNote();
    return;
  }

  // Handle arrow keys to add/subtract a week
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault();
    
    // Only adjust if we have a valid date set
    if (date[0] && date[1] && date[2]) {
      const currentDate = new Date(date[2], date[1] - 1, date[0]);
      const adjustment = event.key === 'ArrowUp' ? 7 : -7;
      currentDate.setDate(currentDate.getDate() + adjustment);
      
      updateDate([currentDate.getDate(), currentDate.getMonth() + 1, currentDate.getFullYear()]);
    }
    return;
  }
}

// Handle day input changes and shortcuts
function processDayInput() {
  const input = eDay.value.toLowerCase().trim();

  if (!input) {
    dayInputMode = null;
    return;
  }
  const dayNumber = getDayNumber(input);
  // Case 1: "X" - Set to today and save
  if (input === 'x') {
    const today = new Date();
    updateDate([today.getDate(), today.getMonth() + 1, today.getFullYear()]);
    saveNote();
    return;
  }else if (input.startsWith('n') && input.length > 1) {
    // Case 2: "N" followed by day name (e.g., "nfri", "nwed")
    dayInputMode = 'n-mode';
    const dayPart = input.substring(1);
    const dayNumber = getDayNumber(dayPart);
    
    if (dayNumber !== null) {
      const nextNextDate = getNextNextDateForDay(dayNumber);
      if (nextNextDate) {
        updateDate(nextNextDate);
      }
    }
    return;
  }else if (dayNumber !== null) {
    // Case 3: Weekday name or abbreviation
    dayInputMode = 'weekday';
    const nextDate = getNextDateForDay(dayNumber);
    if (nextDate) {
      updateDate(nextDate);
    }
    return;
  }else if (/^\d+$/.test(input)) {
    // Case 4: Number - Update day only and focus month
    dayInputMode = 'number';
    const dayValue = parseInt(input);
    if (dayValue >= 1 && dayValue <= 31) {
      date[0] = dayValue;
      eDay.value = dayValue;
      eMonth.focus();
    }
    return;
  }
}

// Attach event listeners to eDay input
if (eDay) {
  eDay.addEventListener('keydown', handleDayInput);
  eDay.addEventListener('input', processDayInput);
}


