'use client';

import { useEffect, useRef, useState } from 'react';

let runtime;

function loadRuntime() {
  runtime ??= Promise.all([
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/_mosaic-runtime/artifact.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    }),
    new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/_mosaic-runtime/artifact.js';
      script.onload = () => window.mountMosaicArtifact ? resolve(window.mountMosaicArtifact) : reject();
      script.onerror = reject;
      document.head.append(script);
    }),
  ]).then(([, mount]) => mount);
  return runtime;
}

export function FrameworkArtifact({ artifact, children }) {
  const host = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    let dispose;
    setStatus('loading');
    loadRuntime().then((mount) => {
      if (!active) return;
      dispose = mount(host.current, artifact);
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('failed');
    });
    return () => {
      active = false;
      void dispose?.();
    };
  }, [artifact]);

  return <>
    {status !== 'ready' && <div inert>{children}</div>}
    <div ref={host} hidden={status !== 'ready'} data-mosaic-runtime={status} />
    {status === 'failed' && <p role="alert">Mosaic couldn’t load this content. Reload the page to try again.</p>}
  </>;
}
