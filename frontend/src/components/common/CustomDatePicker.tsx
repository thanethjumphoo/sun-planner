import { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CustomDatePickerProps {
  value: string; // Format: YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

// Convert Christian Year (YYYY-MM-DD) to Buddhist Year (DD/MM/YYYY)
const convertYmdToDmyThai = (ymd: string): string => {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  const christianYear = parseInt(year, 10);
  if (isNaN(christianYear)) return '';
  const thaiYear = christianYear + 543;
  return `${day}/${month}/${thaiYear}`;
};

// Convert Buddhist Year (DD/MM/YYYY) to Christian Year (YYYY-MM-DD)
const convertDmyThaiToYmd = (dmy: string): string | null => {
  if (!dmy) return null;
  const parts = dmy.split('/');
  if (parts.length !== 3) return null;
  const [day, month, thaiYearStr] = parts;
  const thaiYear = parseInt(thaiYearStr, 10);
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  if (isNaN(thaiYear) || isNaN(d) || isNaN(m)) return null;
  
  // Basic range validation
  if (d < 1 || d > 31 || m < 1 || m > 12 || thaiYear < 2400) return null;
  
  const christianYear = thaiYear - 543;
  const formattedMonth = String(m).padStart(2, '0');
  const formattedDay = String(d).padStart(2, '0');
  
  // Valid calendar date check (e.g. Feb 30, April 31)
  const testDate = new Date(christianYear, m - 1, d);
  if (
    testDate.getFullYear() !== christianYear ||
    testDate.getMonth() !== m - 1 ||
    testDate.getDate() !== d
  ) {
    return null;
  }
  
  return `${christianYear}-${formattedMonth}-${formattedDay}`;
};

export default function CustomDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'วว/ดด/ปปปป',
  disabled = false
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Month showing in the calendar view
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(value);
    return isNaN(d.getTime()) ? new Date() : new Date();
  });

  // Keep internal input value in sync with external value
  useEffect(() => {
    if (value) {
      setInputValue(convertYmdToDmyThai(value));
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  // Handle clicking outside to close popover
  useEffect(() => {
    if (disabled) {
      setIsOpen(false);
      return;
    }
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [disabled]);

  // Validate and parse manual text input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Extract only digits and slice to max 8 digits (DDMMYYYY)
    const numbersOnly = val.replace(/\D/g, '').slice(0, 8);
    
    if (numbersOnly.length === 0) {
      setInputValue('');
      onChange(''); // Clear date value in parent
      return;
    }

    // Generate masked string 'DD/MM/YYYY' using '__/__/____' template
    let formatted = '';
    let numIdx = 0;
    const mask = '__/__/____';
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === '_') {
        if (numIdx < numbersOnly.length) {
          formatted += numbersOnly[numIdx];
          numIdx++;
        } else {
          formatted += '_';
        }
      } else {
        formatted += '/';
      }
    }
    
    setInputValue(formatted);

    // Find index of the first '_' to set the cursor there (so it sits at the current input digit)
    const firstUnderscore = formatted.indexOf('_');
    const nextCursorPos = firstUnderscore !== -1 ? firstUnderscore : formatted.length;

    // Set selection range on the input in next tick
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
      }
    });

    // Validate and update when full 8 digits are typed
    if (numbersOnly.length === 8) {
      const ymd = convertDmyThaiToYmd(formatted);
      if (ymd) {
        const parsedDate = new Date(ymd);
        if (!isNaN(parsedDate.getTime())) {
          onChange(ymd);
          setViewDate(parsedDate);
        }
      }
    }
  };

  const handleFocus = () => {
    if (!inputValue || inputValue === '') {
      setInputValue('__/__/____');
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(0, 0);
        }
      });
    }
  };

  const handleBlur = () => {
    const numbersOnly = inputValue.replace(/\D/g, '');
    if (numbersOnly.length === 0) {
      setInputValue('');
    }
  };

  // Helper to generate calendar days
  const calendarCells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // First day of current month
    const firstDay = new Date(year, month, 1);
    // Day of the week for first day (0 = Sun, 1 = Mon, etc.)
    const startDayOfWeek = firstDay.getDay();

    // Number of days in current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Number of days in previous month
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: { date: Date; isCurrentMonth: boolean; key: string }[] = [];

    // Fill previous month overflow days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        key: `prev-${d.getTime()}`
      });
    }

    // Fill current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      cells.push({
        date: d,
        isCurrentMonth: true,
        key: `curr-${d.getTime()}`
      });
    }

    // Fill next month overflow days to make complete 6-row grid (42 cells)
    const remainingCells = 42 - cells.length;
    for (let i = 1; i <= remainingCells; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({
        date: d,
        isCurrentMonth: false,
        key: `next-${d.getTime()}`
      });
    }

    return cells;
  }, [viewDate]);

  // Format date to local YYYY-MM-DD
  const formatToYmd = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${date}`;
  };

  const handleSelectDate = (d: Date) => {
    const ymd = formatToYmd(d);
    onChange(ymd);
    setInputValue(convertYmdToDmyThai(ymd));
    setIsOpen(false);
  };

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const weekdayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

  const isSelected = (d: Date) => {
    return value === formatToYmd(d);
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <input
          type="text"
          ref={inputRef}
          disabled={disabled}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="w-full px-4 py-2 pr-10 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 transition-all font-mono tracking-wider font-semibold text-gray-800"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 disabled:hover:text-gray-400 transition-colors"
        >
          <CalendarIcon size={16} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[9999] mt-1.5 p-4 bg-white border border-gray-200/80 rounded-2xl shadow-xl w-72"
          >
            {/* Header: Month & Year selection */}
            <div className="flex justify-between items-center mb-4">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 hover:bg-slate-50 text-gray-500 hover:text-orange-500 rounded-lg transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-gray-800">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear() + 543}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 hover:bg-slate-50 text-gray-500 hover:text-orange-500 rounded-lg transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekdays labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {weekdayNames.map(day => (
                <span key={day} className="text-[10px] font-bold text-gray-400 uppercase">
                  {day}
                </span>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.map(cell => {
                const selected = isSelected(cell.date);
                const today = isToday(cell.date);
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => handleSelectDate(cell.date)}
                    className={`h-8 w-8 text-xs font-semibold rounded-lg flex items-center justify-center transition-all ${
                      selected
                        ? 'bg-orange-500 text-white shadow-md shadow-orange-100'
                        : today
                        ? 'bg-orange-50 text-orange-600 font-bold border border-orange-200/50'
                        : cell.isCurrentMonth
                        ? 'text-gray-700 hover:bg-slate-50'
                        : 'text-gray-300 hover:bg-slate-50/50'
                    }`}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
