DROP FUNCTION IF EXISTS notify_student_of_request_response() CASCADE;

CREATE FUNCTION notify_student_of_request_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $body$
DECLARE
    v_class_name TEXT;
    v_title TEXT;
    v_msg TEXT;
    v_role_id UUID;
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('approved', 'denied') THEN
        SELECT name INTO v_class_name
        FROM classes
        WHERE id = NEW.class_id;

        IF NEW.status = 'approved' THEN
            v_title := 'Join Request Approved';
            v_msg := 'Your request to join ' || v_class_name || ' has been approved!';
        ELSE
            v_title := 'Join Request Denied';
            v_msg := 'Your request to join ' || v_class_name || ' was not approved.';
            IF NEW.teacher_response IS NOT NULL THEN
                v_msg := v_msg || ' Reason: ' || NEW.teacher_response;
            END IF;
        END IF;

        INSERT INTO notifications (user_id, type, title, message, link, read)
        VALUES (
            NEW.user_id,
            'join_request_response',
            v_title,
            v_msg,
            '/classes/' || NEW.class_id,
            FALSE
        );

        IF NEW.status = 'approved' THEN
            SELECT id INTO v_role_id
            FROM roles
            WHERE name = 'student';

            INSERT INTO class_members (class_id, user_id, role_id)
            VALUES (NEW.class_id, NEW.user_id, v_role_id)
            ON CONFLICT (class_id, user_id, role_id) DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$body$;

CREATE TRIGGER join_request_response_notification
    AFTER UPDATE ON class_join_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_student_of_request_response();
