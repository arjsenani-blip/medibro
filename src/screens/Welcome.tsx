import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';

const WORD = 'ReadRx';

/**
 * First launch. The capsule grows in on the spring, the name rises letter by
 * letter, then the tagline and the button. Tapping anywhere skips to the end;
 * with reduced motion it's the finished screen, faded in.
 */
export default function Welcome({ onStart }: { onStart: () => void }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`intro flex min-h-dvh flex-col items-center px-6 text-center ${done ? 'done' : ''}`} onPointerDown={() => setDone(true)}>
      <div className="safe-top flex flex-1 flex-col items-center justify-center pt-10">
        <img src="/icon-512.png" alt="ReadRx logo: a glass capsule" className="intro-mark size-40 rounded-[26%]" />
        <h1 className="headline mt-9 text-[3rem] tracking-[-0.035em]" aria-label={WORD}>
          {[...WORD].map((ch, i) => (
            <span key={i} className="intro-letter" style={{ '--i': i } as React.CSSProperties} aria-hidden>
              {ch}
            </span>
          ))}
        </h1>
        <p className="intro-tag mt-3 max-w-[22ch] text-[1.25rem] leading-snug font-medium text-ink-strong">Your prescription labels, read out loud.</p>
      </div>
      <div className="intro-cta safe-bottom w-full max-w-[30rem] pt-6">
        <button type="button" onClick={onStart} className="btn btn-primary min-h-16 w-full text-[1.2rem]">
          Get started <ArrowRight className="size-6" aria-hidden />
        </button>
      </div>
    </div>
  );
}
