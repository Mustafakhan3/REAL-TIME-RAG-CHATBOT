import React from "react";

function Message({ text, sender, sources = [] }) {
  const isUser = sender === "user";

  // Bubble width (kept same for layout consistency)
 // Bubble width (cap to viewport on phones to prevent horizontal overflow)
const bubbleMax = isUser
  ? "max-w-[94vw] sm:max-w-[420px] md:max-w-[460px] xl:max-w-[520px]"
  : "max-w-[94vw] sm:max-w-[460px] md:max-w-[500px] xl:max-w-[580px]";



  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${bubbleMax}`}>
       <div
  className={`inline-block w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl shadow-sm
  whitespace-pre-wrap break-words overflow-hidden text-ellipsis
  text-[0.8125rem] sm:text-[0.84375rem] md:text-[0.875rem] leading-relaxed
  ${isUser ? "bg-indigo-600 text-white rounded-br-sm"
           : "bg-zinc-800 text-zinc-100 rounded-bl-sm"}`}
>

          <p className="whitespace-pre-wrap break-words">{text}</p>

          {/* 🔹 Sources (assistant only) */}
          {!isUser && sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] sm:text-[10.5px] text-zinc-400 break-words overflow-hidden">
              <p className="font-medium text-zinc-300 mb-1">Sources:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {sources.map((src, i) => (
                  <li key={i} className="truncate leading-snug">
                    <a
                      href={src.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline break-all"
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

