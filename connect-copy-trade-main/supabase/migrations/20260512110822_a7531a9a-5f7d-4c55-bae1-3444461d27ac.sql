
DELETE FROM public.khumo_knowledge_base WHERE source = 'pro_forex_institute';

INSERT INTO public.khumo_knowledge_base (topic, keywords, content, source, difficulty, order_index)
SELECT 
  title, 
  COALESCE(tags, '{}'::text[]) || ARRAY[lower(COALESCE(category,''))],
  title || E'\n\n' || COALESCE(description,'') || E'\n\n' || COALESCE(content_text,''),
  'pro_forex_institute',
  difficulty,
  order_index
FROM public.training_content
WHERE content_text IS NOT NULL AND content_text <> ''
  AND category IN ('Foundation','Analysis','Smart Money','Patterns','Indicators','Risk Management','Psychology');
