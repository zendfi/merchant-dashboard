'use client';

import { useState, useRef, useEffect } from 'react';
import { useMerchant } from '@/lib/merchant-context';

export default function SupportTab() {
    const { merchant } = useMerchant();
    const [messages, setMessages] = useState<{ id: string; sender: 'user' | 'agent'; text: string; timestamp: Date }[]>([
        {
            id: '1',
            sender: 'agent',
            text: `Hi ${merchant?.name || 'there'}! 👋 How can we help you today?`,
            timestamp: new Date()
        }
    ]);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!newMessage.trim()) return;

        const userMsg = {
            id: Date.now().toString(),
            sender: 'user' as const,
            text: newMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setNewMessage('');
        setIsSending(true);

        // Simulate sending to email/backend
        try {
            // In a real app, this would call an API endpoint that sends an email
            // await api.sendSupportMessage(newMessage);

            // Simulate reply after a delay
            setTimeout(() => {
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    sender: 'agent',
                    text: "Thanks for reaching out! We've received your message and our support team will get back to you via email shortly.",
                    timestamp: new Date()
                }]);
                setIsSending(false);
            }, 1000);
        } catch (error) {
            console.error('Failed to send message:', error);
            setIsSending(false);
        }
    };

    const handleScheduleVideo = () => {
        // This would typically open a Calendly link or similar
        window.open('https://calendly.com/zendfi/support', '_blank');
    };

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6">
            {/* Chat Section */}
            <div className="flex-1 flex flex-col bg-white dark:bg-[#1f162b] rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                {/* Chat Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#1f162b]">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary">support_agent</span>
                            </div>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#1f162b] rounded-full"></span>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">Live Support</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Typically replies in a few minutes</p>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#1a1225]">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.sender === 'user'
                                        ? 'bg-primary text-white rounded-br-none'
                                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-none shadow-sm'
                                    }`}
                            >
                                <p>{msg.text}</p>
                                <span className={`text-[10px] mt-1 block opacity-70 ${msg.sender === 'user' ? 'text-primary-100' : 'text-slate-400'
                                    }`}>
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    ))}
                    {isSending && (
                        <div className="flex justify-start">
                            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-100 dark:border-slate-700 shadow-sm">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-[#1f162b] border-t border-slate-100 dark:border-slate-800">
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 transition-colors flex items-center justify-center min-w-[48px]"
                        >
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-slate-400 mt-2">
                        Replies will be sent to your email address: <span className="font-medium text-slate-600 dark:text-slate-300">{merchant?.email || 'your email'}</span>
                    </p>
                </div>
            </div>

            {/* Sidebar Info */}
            <div className="w-full lg:w-80 space-y-4">
                {/* Video Chat Card */}
                <div className="bg-white dark:bg-[#1f162b] rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4">
                        <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400">videocam</span>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Face-to-face Support</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
                        Need complex help? Schedule a 15-minute video call with our support team.
                    </p>
                    <button
                        onClick={handleScheduleVideo}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
                        Schedule Video Chat
                    </button>
                </div>

                {/* Contact Info */}
                <div className="bg-gradient-to-br from-primary/5 to-purple-500/5 rounded-xl p-5 border border-primary/10">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-3">Other Ways to Connect</h3>
                    <div className="space-y-3">
                        <a href="mailto:hello@zendfi.tech" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[18px]">mail</span>
                            hello@zendfi.tech
                        </a>
                        <a href="https://twitter.com/zendfi" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[18px]">public</span>
                            @zendfi on Twitter
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
