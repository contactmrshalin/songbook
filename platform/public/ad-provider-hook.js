// Runtime trigger:
//   NEXT_PUBLIC_AD_RUNTIME_MODE=hook
//   NEXT_PUBLIC_AD_FALLBACK_PROVIDER=propellerads
//   NEXT_PUBLIC_PROPELLER_INVOKE_DOMAIN=<provider-domain>
//   NEXT_PUBLIC_PROPELLER_ZONE_SONG_TOP=<zone-id>
//   NEXT_PUBLIC_PROPELLER_ZONE_SONG_MID=<zone-id>
//   NEXT_PUBLIC_PROPELLER_ZONE_SONG_BOTTOM=<zone-id>
//   NEXT_PUBLIC_PROPELLER_ZONE_HOME_TOP=<zone-id>
//   NEXT_PUBLIC_PROPELLER_ZONE_HOME_FEED=<zone-id>

function renderPropellerVisibleSlot(el) {
  var zoneId = (el && el.dataset && el.dataset.adProviderZone) || "";
  var invokeDomain = (el && el.dataset && el.dataset.adProviderInvokeDomain) || "";

  if (!zoneId || !invokeDomain) {
    el.style.display = "none";
    return;
  }

  var containerId = "container-" + zoneId;

  el.innerHTML = "";
  el.style.display = "block";
  el.style.minHeight = "90px";

  var slotContainer = document.createElement("div");
  slotContainer.id = containerId;
  el.appendChild(slotContainer);

  var script = document.createElement("script");
  script.async = true;
  script.setAttribute("data-cfasync", "false");
  script.src = "https://" + invokeDomain + "/" + zoneId + "/invoke.js";
  script.onerror = function () {
    el.style.display = "none";
  };
  el.appendChild(script);
}

window.songbookAdProviderActivate = function songbookAdProviderActivate(ctx) {
  var provider = (ctx && ctx.provider) || "none";
  var slots = document.querySelectorAll("[data-ad-provider-slot]");

  if (!slots.length) return;
  if (provider !== "propellerads") return;

  slots.forEach(function (el) {
    if (!el || el.hasAttribute("data-ad-provider-initialized")) return;
    el.setAttribute("data-ad-provider-initialized", "true");
    renderPropellerVisibleSlot(el);
  });
};
