import React from 'react';

/**
 * Blink logo — a chat bubble with a clock + lock motif.
 * Represents secure, ephemeral messaging.
 */
export function BlinkLogo({ size = 28 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Chat bubble shape */}
            <path
                d="M32 4C16.536 4 4 14.745 4 28c0 7.442 4.166 14.06 10.667 18.453L12 54c0 0 8.14-2.333 12.667-4.267C26.533 50.244 29.211 50.5 32 50.5 47.464 50.5 60 40.255 60 27s-12.536-23-28-23z"
                fill="url(#bubbleGrad)"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1"
            />
            {/* Clock circle */}
            <circle
                cx="32"
                cy="26"
                r="14"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2"
            />
            {/* Clock tick marks */}
            <line x1="32" y1="14" x2="32" y2="16" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="32" y1="36" x2="32" y2="38" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="20" y1="26" x2="22" y2="26" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="42" y1="26" x2="44" y2="26" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
            {/* Hour hand */}
            <line
                x1="32"
                y1="26"
                x2="32"
                y2="19"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
            />
            {/* Minute hand */}
            <line
                x1="32"
                y1="26"
                x2="39"
                y2="21"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
            />
            {/* Lock body */}
            <rect
                x="28"
                y="28"
                width="8"
                height="7"
                rx="1.5"
                fill="white"
            />
            {/* Lock shackle */}
            <path
                d="M30 28v-2.5a2 2 0 114 0V28"
                stroke="white"
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
            />
            {/* Lock keyhole */}
            <circle cx="32" cy="31.5" r="1" fill="url(#bubbleGrad)" />
            <defs>
                <linearGradient id="bubbleGrad" x1="4" y1="4" x2="60" y2="54" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#06b6d4" />
                    <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
            </defs>
        </svg>
    );
}
