-- تمكين العميل من تعديل اسمه ورقم هاتفه فقط في صفه الشخصي.
-- لا يمنح العميل صلاحية تغيير role أو account_status أو is_verified.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers update own basic profile" ON public.profiles;
CREATE POLICY "customers update own basic profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_customer_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='account_status') THEN
      NEW.account_status := OLD.account_status;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='is_verified') THEN
      NEW.is_verified := OLD.is_verified;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='warning_message') THEN
      NEW.warning_message := OLD.warning_message;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_customer_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_customer_profile_fields_trigger
BEFORE UPDATE ON public.profiles FOR EACH ROW
EXECUTE FUNCTION public.protect_customer_profile_fields();
