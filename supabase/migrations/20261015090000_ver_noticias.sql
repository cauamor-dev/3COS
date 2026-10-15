-- News for Nox (ChatGPT plugin): same idea as the ver_noticias tool of the API/MCP.
-- Interests and muted topics come from settings('news'); stories matching more
-- interests come first, then the newest.

create function central.ver_noticias(p_topico text default null, p_horas int default 48, p_limite int default 10)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_settings jsonb := coalesce((select value from public.settings where key = 'news'), '{}'::jsonb);
  v_keywords text[] := array(select jsonb_array_elements_text(coalesce(v_settings -> 'keywords', '[]'::jsonb)));
  v_muted text[] := array(select lower(jsonb_array_elements_text(coalesce(v_settings -> 'mutedTopics', '[]'::jsonb))));
  result jsonb;
begin
  select jsonb_build_object(
    'noticias', coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'titulo', n.title,
      'resumo', left(n.summary, 400),
      'fonte', n.fonte,
      'url', n.url,
      'imagem', nullif(n.image_url, ''),
      'topico', n.topic,
      'publicada_em', n.published_at,
      'interesses', case when cardinality(n.hits) > 0 then to_jsonb(n.hits) end
    )) order by cardinality(n.hits) desc, n.published_at desc), '[]'::jsonb),
    'total', count(*)
  )
  into result
  from (
    select i.title, i.summary, i.url, i.image_url, i.topic, i.published_at, f.name as fonte, h.hits
    from public.news_items i
    join public.news_feeds f on f.id = i.feed_id
    -- Same rule as the app's keywordHits: short keywords ("IA") match whole words only,
    -- longer ones (".NET", "Next.js") match anywhere, ignoring case.
    cross join lateral (
      select array(
        select k from unnest(v_keywords) k
        where case
          when length(k) <= 3 then (' ' || lower(i.title || ' ' || i.summary) || ' ')
            ~ ('[^[:alnum:]]' || regexp_replace(lower(k), '([.+*?^$()\[\]{}|\\])', '\\\1', 'g') || '[^[:alnum:]]')
          else strpos(lower(i.title || ' ' || i.summary), lower(k)) > 0
        end
      ) as hits
    ) h
    where i.published_at >= now() - make_interval(hours => least(greatest(coalesce(p_horas, 48), 1), 168))
      and not (lower(i.topic) = any(v_muted))
      and (p_topico is null or i.topic ilike '%' || p_topico || '%')
    order by cardinality(h.hits) desc, i.published_at desc
    limit least(greatest(coalesce(p_limite, 10), 1), 30)
  ) n;
  return result;
end;
$$;

revoke all on function central.ver_noticias(text, int, int) from public, anon, authenticated;
