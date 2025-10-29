import React from "react";

function Message({ text, sender, sources = [] }) {
  const isUser = sender === "user";

  // Bubble width caps in rem (for consistent scaling across hosts/devices)
  // 420px→26.25rem, 460px→28.75rem, 500px→31.25rem, 520px→32.5rem, 580px→36.25rem
  const bubbleMax = isUser
    ? "max-w-[94vw] sm:max-w-[26.25rem] md:max-w-[28.75rem] xl:max-w-[32.5rem]"
    : "max-w-[94vw] sm:max-w-[28.75rem] md:max-w-[31.25rem] xl:max-w-[36.25rem]";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={bubbleMax}>
        <div
          className={`inline-block w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl shadow-sm
  whitespace-pre-wrap break-words overflow-hidden text-ellipsis
  text-[0.8125rem] sm:text-[0.84375rem] md:text-[0.875rem] leading-relaxed
  ${isUser ? "bg-indigo-600 text-white rounded-br-sm" : "bg-zinc-800 text-zinc-100 rounded-bl-sm"}`}
        >
          <p className="whitespace-pre-wrap break-words">{text}</p>

          {/* Sources (assistant only) */}
          {!isUser && sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-700 text-[0.625rem] sm:text-[0.65625rem] text-zinc-400 break-words overflow-hidden">
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
