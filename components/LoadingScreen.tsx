'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function LoadingScreen() {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        // Simulate loading progress
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                // Fast initial load, slow down near the end
                const increment = prev < 60 ? 8 : prev < 85 ? 3 : 1;
                return Math.min(prev + increment, 100);
            });
        }, 80);

        return () => clearInterval(interval);
    }, []);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f7f6f8] dark:bg-[#0f0a18] transition-opacity duration-500">

            <div className="relative flex flex-col items-center gap-8">
                {/* Brand name */}
                <div className="loading-text-entrance">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/logo.png"
                            alt="Zendfi Logo"
                            width={120}
                            height={32}
                            className="h-8 w-auto filter hue-rotate-[19deg] dark:hue-rotate-[13deg] brightness-110"
                            priority
                        />
                    </Link>
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center mt-1 font-medium">
                        Merchant Dashboard
                    </p>
                </div>

                {/* Loading bar */}
                <div className="w-48 loading-bar-entrance">
                    <div className="h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-primary via-purple-400 to-primary rounded-full transition-all duration-300 ease-out relative"
                            style={{ width: `${progress}%` }}
                        >
                            {/* Glow on the tip */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full blur-sm" />
                        </div>
                    </div>

                    {/* Loading dots */}
                    <div className="flex items-center justify-center gap-1 mt-4">
                        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Loading</span>
                        <span className="loading-dots flex gap-0.5">
                            <span className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full loading-dot-1" />
                            <span className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full loading-dot-2" />
                            <span className="w-1 h-1 bg-slate-400 dark:bg-slate-500 rounded-full loading-dot-3" />
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
