import React from "react";

function Message({ text, sender, sources = [] }) {
  const isUser = sender === "user";
  const bubbleMax = isUser
    ? "max-w-[280px] sm:max-w-[400px] md:max-w-[440px] xl:max-w-[500px]"
    : "max-w-[400px] sm:max-w-[440px] md:max-w-[480px] xl:max-w-[560px]";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`${bubbleMax}`}>
        <div
          className={`inline-block w-fit max-w-full px-3 py-2 sm:px-4 sm:py-3 rounded-xl text-[12px] sm:text-[13px] leading-relaxed shadow-sm 
          whitespace-pre-wrap break-words break-all overflow-hidden text-ellipsis ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
          }`}
        >
          <p>{text}</p>

          {/* 🔹 Sources section for bot messages */}
          {!isUser && sources.length > 0 && (
            <div className="mt-3 pt-2 border-t border-zinc-700 text-[11px] text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">Sources:</p>
              <ul className="list-disc list-inside space-y-1">
                {sources.map((src, i) => (
                  <li key={i} className="truncate leading-snug">
                    <a
                      href={src.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
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
