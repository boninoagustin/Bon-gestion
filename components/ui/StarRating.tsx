import React from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
    score: number;
    setScore?: (n: number) => void;
    size?: number;
}

export const StarRating: React.FC<StarRatingProps> = ({ score, setScore, size = 18 }) => {
    return (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    onClick={() => setScore && setScore(star)}
                    className={`${setScore ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform focus:outline-none`}
                    type="button"
                >
                    <Star
                        size={size}
                        className={`${star <= score ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'}`}
                    />
                </button>
            ))}
        </div>
    );
};
