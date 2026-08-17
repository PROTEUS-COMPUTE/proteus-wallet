/*
 * The page floor: a lime wash plus the faint circuit map from the desktop app,
 * so the site and the miner client read as the same product.
 *
 * The wash is not decoration: the frosted cards have nothing to blur over a flat
 * background, and they fall back to looking plain white. The circuit sits above
 * it and below the content, kept very low-contrast so it never fights the text.
 */

// Same trace map as the desktop client (styles.css, .app-shell::before), but
// darker: the client draws it on near-white, and on our lavender the original
// %23dce3e5 was ~7/255 of contrast, i.e. invisible.
const CIRCUIT =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='700' height='440' viewBox='0 0 700 440'%3E%3Cg fill='none' stroke='%23c3ccd6' stroke-width='1.2'%3E%3Cpath d='M0 38h42l24 24h104l28 28v56l20 20h92l24-24V74l34-34h77l24 24v75l22 22h88l26-26V37h93'/%3E%3Cpath d='M0 120h55l25 25h72l30 30v94l29 29h77l31-31v-49l22-22h92l30 30v105l23 23h92l31-31v-72l22-22h91'/%3E%3Cpath d='M0 258h88l23 23v59l38 38h90l28-28v-70l21-21h95l25 25v57l34 34h119l29-29v-83l24-24h73'/%3E%3Cpath d='M126 0v32l24 24v45M263 0v48l25 25v60M507 0v51l27 27v36M631 0v81l-28 28v60M33 440v-44l25-25v-56M192 440v-27l24-24v-68M408 440v-44l27-27v-51M583 440v-38l25-25v-58'/%3E%3C/g%3E%3Cg fill='%23b3bfcc'%3E%3Ccircle cx='66' cy='62' r='3'/%3E%3Ccircle cx='218' cy='166' r='3'/%3E%3Ccircle cx='312' cy='218' r='3'/%3E%3Ccircle cx='452' cy='161' r='3'/%3E%3Ccircle cx='544' cy='226' r='3'/%3E%3Ccircle cx='111' cy='340' r='3'/%3E%3Ccircle cx='289' cy='259' r='3'/%3E%3Ccircle cx='522' cy='395' r='3'/%3E%3C/g%3E%3C/svg%3E\")";

export default function Ambient() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute -top-40 -left-32 w-[620px] h-[620px] rounded-full bg-brand-lime/25 blur-[130px]" />
      <div className="absolute top-1/3 -right-40 w-[680px] h-[680px] rounded-full bg-[#b9cbe4]/45 blur-[140px]" />
      <div className="absolute -bottom-40 left-1/4 w-[560px] h-[560px] rounded-full bg-brand-lime-deep/15 blur-[130px]" />

      {/* NB: whatever mounts this must not carry an opaque background of its own.
          The landing root had bg-bg-base and it hid this layer entirely (a red
          test circuit at full opacity did not show). The body carries the colour.

          The mask keeps the traces on the flanks and clears the middle, so the
          board frames the page instead of running under the reading column. */}
      <div
        className="absolute inset-0 opacity-[0.85]"
        style={{
          backgroundImage: CIRCUIT,
          backgroundRepeat: 'repeat',
          backgroundPosition: 'center top',
          maskImage: 'linear-gradient(to right, #000 0%, transparent 26%, transparent 74%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(to right, #000 0%, transparent 26%, transparent 74%, #000 100%)',
        }}
      />
    </div>
  );
}
