import React, { useState, useEffect } from 'react';
import { DateRange } from '../types';
import { startOfWeek, endOfWeek, subWeeks, startOfMonth, endOfMonth, subMonths, getWeek, getMonth, getYear, addWeeks, differenceInWeeks, subDays, differenceInDays, addDays } from 'date-fns';
import { ko } from 'date-fns/locale';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (newDateRange: DateRange) => void;
  onFetchResources: () => void;
}

export default function DateRangePicker({ dateRange, onDateRangeChange, onFetchResources }: DateRangePickerProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsMinimized(scrollPosition > 1000); // 100px 이상 스크롤되면 최소화
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    newDate.setHours(dateRange.startDate.getHours(), dateRange.startDate.getMinutes(), dateRange.startDate.getSeconds());
    console.log("시작 날짜 변경:", newDate);
    onDateRangeChange({ ...dateRange, startDate: newDate });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    newDate.setHours(dateRange.endDate.getHours(), dateRange.endDate.getMinutes(), dateRange.endDate.getSeconds());
    console.log("종료 날짜 변경:", newDate);
    onDateRangeChange({ ...dateRange, endDate: newDate });
  };

  const formatDateForInput = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleQuickSelect = (period: string) => {
    const today = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'thisWeek':
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'lastMonth1':
      case 'lastMonth2':
      case 'lastMonth3':
      case 'lastMonth4':
      case 'lastMonth5':
        const lastMonth = subMonths(today, 1);
        const firstDayOfLastMonth = startOfMonth(lastMonth);
        let firstSundayOfLastMonth = startOfWeek(firstDayOfLastMonth, { weekStartsOn: 1 });
        
        // 첫 번째 일요일이 이전 달에 있는 경우, 다음 주 일요일부터 시작
        if (getMonth(firstSundayOfLastMonth) !== getMonth(lastMonth)) {
          firstSundayOfLastMonth = addWeeks(firstSundayOfLastMonth, 1);
        }
        
        const weekNumber = parseInt(period.slice(-1));
        start = addWeeks(firstSundayOfLastMonth, weekNumber - 1);
        end = addDays(start, 6);  // 시작일로부터 6일 후가 종료일 (7일 기간)
        break;
      default:
        return;
    }

    onDateRangeChange({ startDate: start, endDate: end });
  };

  const getCurrentWeek = () => {
    const today = new Date();
    const firstDayOfMonth = startOfMonth(today);
    const firstSundayOfMonth = startOfWeek(firstDayOfMonth, { weekStartsOn: 1 });
    const weekNumber = Math.floor(differenceInWeeks(today, firstSundayOfMonth)) + 1;
    return weekNumber;
  };

  const getLastMonthName = () => {
    const lastMonth = subMonths(new Date(), 1);
    return lastMonth.toLocaleString('ko-KR', { month: 'long' });
  };

  const getLastMonthWeeks = () => {
    const lastMonth = subMonths(new Date(), 1);
    const firstDayOfLastMonth = startOfMonth(lastMonth);
    let firstSundayOfLastMonth = startOfWeek(firstDayOfLastMonth, { weekStartsOn: 1 });
    
    // 첫 번째 일요일이 이전 달에 있는 경우, 다음 주 일요일을 사용
    if (getMonth(firstSundayOfLastMonth) !== getMonth(lastMonth)) {
      firstSundayOfLastMonth = addWeeks(firstSundayOfLastMonth, 1);
    }
    
    const lastDayOfMonth = endOfMonth(lastMonth);
    const lastSundayOfMonth = startOfWeek(lastDayOfMonth, { weekStartsOn: 1 });
    const weeksCount = differenceInWeeks(lastSundayOfMonth, firstSundayOfLastMonth) + 1;
    return weeksCount;
  }; 

  return (
    <div className={`date-range-picker fixed top-20 right-4 bg-white p-4 rounded-xl shadow-apple transition-all duration-300 ease-in-out ${isMinimized ? 'w-16 h-16 overflow-hidden' : 'w-56'}`}>
      {isMinimized ? (
        <button 
          onClick={() => setIsMinimized(false)}
          className="w-full h-full flex items-center justify-center text-2xl text-gray-700"
        >
          📅
        </button>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-700">조회 기간 설정</h2>
          <div className="flex flex-col space-y-4 mt-2">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">시작 날짜</label>
              <input
                type="date"
                id="startDate"
                value={formatDateForInput(dateRange.startDate)}
                onChange={handleStartDateChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">종료 날짜</label>
              <input
                type="date"
                id="endDate"
                value={formatDateForInput(dateRange.endDate)}
                onChange={handleEndDateChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
              />
            </div>
          </div>
          <div className="text-sm font-medium text-gray-700 mt-4">주차 선택</div>
          <div className="flex flex-col space-y-2 mt-2">
            <button 
              onClick={() => handleQuickSelect('thisWeek')} 
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
            >
              이번 주 ({getCurrentWeek()}주차)
            </button>
            {Array.from({ length: getLastMonthWeeks() }, (_, i) => (
              <button
                key={i}
                onClick={() => handleQuickSelect(`lastMonth${i + 1}`)}
                className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 w-full"
              >
                {getLastMonthName()} {i + 1}주차
              </button>
            ))}
          </div>
          <button 
            onClick={onFetchResources}
            className="btn btn-primary mt-4 w-full"
          >
            리소스 조회
          </button>
        </>
      )}
    </div>
  );
}
