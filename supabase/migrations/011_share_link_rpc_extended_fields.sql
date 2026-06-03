-- Migration 011: Extend get_bill_by_share_link RPC to surface fields the
-- new cosmic group invoice landing page needs.
--   * organizer_display_name (joined from user_profiles)
--   * bill: payment_method, payment_details, invoice_number
--   * participants: access_token, payment_status

CREATE OR REPLACE FUNCTION public.get_bill_by_share_link(p_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_result  json;
BEGIN
  SELECT bill_id INTO v_bill_id
  FROM share_links
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_bill_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id',                       b.id,
    'title',                    b.title,
    'description',              b.description,
    'total_amount',             b.total_amount,
    'currency',                 b.currency,
    'due_date',                 b.due_date,
    'status',                   b.status,
    'share_link',               b.share_link,
    'category',                 b.category,
    'is_recurring',             b.is_recurring,
    'group_photo_url',          b.group_photo_url,
    'split_type',               b.split_type,
    'tax_rate',                 b.tax_rate,
    'created_at',               b.created_at,
    'updated_at',               b.updated_at,
    'invoice_number',           b.invoice_number,
    'payment_method',           b.payment_method,
    'payment_details',          b.payment_details,
    'organizer_display_name',   COALESCE(up.display_name, 'Organizer'),
    'participants', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',             p.id,
        'name',           p.name,
        'email',          p.email,
        'phone',          p.phone,
        'amount',         p.amount,
        'is_paid',        p.is_paid,
        'paid_at',        p.paid_at,
        'avatar_color',   p.avatar_color,
        'shares',         p.shares,
        'percent',        p.percent,
        'access_token',   p.access_token,
        'payment_status', p.payment_status
      )), '[]'::json)
      FROM participants p WHERE p.bill_id = b.id
    ),
    'line_items', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',          li.id,
        'description', li.description,
        'quantity',    li.quantity,
        'unit_price',  li.unit_price
      )), '[]'::json)
      FROM line_items li WHERE li.bill_id = b.id
    )
  ) INTO v_result
  FROM bills b
  LEFT JOIN user_profiles up ON up.id = b.organizer_id
  WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bill_by_share_link(TEXT) TO anon, authenticated;
