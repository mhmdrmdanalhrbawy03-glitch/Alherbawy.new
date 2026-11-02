// Supabase browser client (v2)
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  const valid=cfg.url && cfg.anonKey && !cfg.url.includes('YOUR-PROJECT') && !cfg.anonKey.includes('YOUR_SUPABASE');
  window.sb = valid && window.supabase ? window.supabase.createClient(cfg.url,cfg.anonKey) : null;
  window.sbReady=!!window.sb;
})();
