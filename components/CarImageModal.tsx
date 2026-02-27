'use client';

import { useState } from 'react';
import Image from 'next/image';

interface CarImageModalProps {
  carImage: string;
  carMake?: string | null;
  carModel?: string | null;
  carYear?: number | null;
}

export default function CarImageModal({ 
  carImage, 
  carMake, 
  carModel, 
  carYear 
}: CarImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Thumbnail - Clickable */}
      <div className="cursor-pointer group" onClick={() => setIsOpen(true)}>
        <Image
          src={carImage}
          alt="Training car"
          width={200}
          height={150}
          className="rounded-lg w-full h-24 object-cover group-hover:opacity-90 transition-opacity"
        />
        <p className="text-xs text-gray-500 mt-1 text-center">Click to enlarge</p>
      </div>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl font-bold"
            >
              ✕ Close
            </button>
            <Image
              src={carImage}
              alt="Training car - Full size"
              width={1200}
              height={800}
              className="rounded-lg w-full object-contain"
            />
            {(carMake || carModel) && (
              <p className="text-white text-center mt-4">
                {carMake} {carModel} {carYear}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
