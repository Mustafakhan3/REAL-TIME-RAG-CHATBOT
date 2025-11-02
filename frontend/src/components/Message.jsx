import React from "react";

function Message({ text, sender, sources = [] }) {
  const isUser = sender === "user";

  const bubbleMax = isUser
    ? "max-w-[96vw] sm:max-w-[36rem] md:max-w-[44rem] xl:max-w-[48rem]"
    : "max-w-[92vw] sm:max-w-[38rem] md:max-w-[46rem] xl:max-w-[52rem]";

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={bubbleMax}>
        <div
          className={`inline-block w-full px-5 py-4 sm:px-6 sm:py-5 rounded-2xl shadow-sm
  whitespace-pre-wrap break-words overflow-x-hidden
  text-base sm:text-[1.05rem] md:text-lg leading-relaxed tracking-[0.01em]
  ${isUser ? "bg-indigo-600 text-white rounded-br-md" : "bg-zinc-800 text-zinc-100 rounded-bl-md"}`}
        >
          {/* wrap anywhere inside message */}
          <p className="msg-content">{text}</p>

          {!isUser && sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-zinc-700 text-[0.9rem] sm:text-[0.95rem] text-zinc-300/90">
              <p className="font-semibold text-zinc-100 mb-2">Sources:</p>
              <ul className="list-disc list-inside space-y-1.5 msg-sources">
                {sources.map((src, i) => (
                  <li key={i}>
                    <a
                      href={src.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block max-w-full break-words"
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
