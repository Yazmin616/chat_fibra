ALTER TABLE public.areas_soluciones 
ADD COLUMN coordinador_id INTEGER REFERENCES public.agentes(id) ON DELETE SET NULL;
