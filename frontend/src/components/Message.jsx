import React from "react";

function Message({ text, sender, sources = [] }) {
  const isUser = sender === "user";

  // Slightly larger bubble caps
  // (kept your rem-based caps; nudged each up ~1–2rem where helpful)
  const bubbleMax = isUser
    ? "max-w-[114vw] sm:max-w-[28rem] md:max-w-[40rem] xl:max-w-[34rem]"
    : "max-w-[94vw]  sm:max-w-[30rem] md:max-w-[40rem] xl:max-w-[38rem]";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={bubbleMax}>
        <div
          className={`inline-block w-full px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-sm
  whitespace-pre-wrap break-words overflow-hidden text-ellipsis
  text-sm sm:text-[0.95rem] md:text-base leading-relaxed
  ${isUser ? "bg-indigo-600 text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm"}`}
        >
          <p className="whitespace-pre-wrap break-words">{text}</p>

          {/* Sources (assistant only) */}
          {!isUser && sources.length > 0 && (
            <div className="mt-3 pt-2.5 border-t border-zinc-700 text-[0.72rem] sm:text-[0.78rem] text-zinc-400 break-words overflow-hidden">
              <p className="font-medium text-zinc-300 mb-1.5">Sources:</p>
              <ul className="list-disc list-inside space-y-1">
                {sources.map((src, i) => (
                  <li key={i} className="truncate leading-snug">
                    <a
                      href={src.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-300 hover:underline break-all"
                    >
                      {src.title || src.link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Message;
