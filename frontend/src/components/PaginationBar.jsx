import formatNumber from '../utils/formatNumber';

export default function PaginationBar({ currentPage, totalPages, onPageChange }) {
  return (
    <div className="mt-auto flex justify-between items-center rounded-xl border border-black/10 bg-gray-50 p-4 shadow-sm">
      <button
        onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
        disabled={currentPage === 1}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          currentPage === 1
            ? 'cursor-default bg-gray-200 text-gray-400 opacity-60'
            : 'cursor-pointer border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-100'
        }`}
      >
        ◀ ก่อนหน้า
      </button>

      <span className="text-sm font-medium text-gray-600">
        หน้า {formatNumber(currentPage)} จาก {formatNumber(totalPages)}
      </span>

      <button
        onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
        disabled={currentPage === totalPages}
        className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
          currentPage === totalPages
            ? 'cursor-default bg-gray-200 text-gray-400 opacity-60'
            : 'cursor-pointer border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-100'
        }`}
      >
        ถัดไป ▶
      </button>
    </div>
  );
}