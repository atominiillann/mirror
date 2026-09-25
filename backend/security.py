import bcrypt

def hash_password(plain_password):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(plain_password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def check_permission(user_role, action, disaster_level, source_quarter=None, target_quarter=None, user_neighborhood=None):
    if action == "view_resources":
        return True, "Accès autorisé", 200

    if disaster_level == 1:
        return False, "Action interdite : Niveau 1 (Watch) - Aucune réservation ou transfert autorisé.", 403

    if disaster_level == 2:
        if action == "reserve_local":
            if user_role == "QC":
                if user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé : rôle non autorisé pour cette action au niveau 2.", 403
        return False, "Action interdite au niveau 2 (Alert).", 403

    if disaster_level == 3:
        if action == "reserve_local":
            if user_role == "QC":
                if user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé pour reserve_local au niveau 3.", 403
        if action == "request_adjacent":
            if user_role == "QC":
                if user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé pour request_adjacent au niveau 3.", 403
        return False, "Action non permise pour ce rôle au niveau 3.", 403

    if disaster_level == 4:
        if action == "reserve_local":
            if user_role == "QC":
                if user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        if action == "request_adjacent":
            if user_role in ["QC", "LC"]:
                if user_role == "QC" and user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        if action == "organize_transit":
            if user_role == "LC":
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        if action == "requisition":
            if user_role == "CD":
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        return False, "Action non permise pour ce rôle au niveau 4.", 403

    if disaster_level == 5:
        if user_role == "CD":
            return True, "Accès autorisé (City Director - Plein pouvoir)", 200
        if action == "reserve_local":
            if user_role == "QC":
                if user_neighborhood and target_quarter and user_neighborhood != target_quarter:
                    return False, "Accès refusé : un QC ne peut agir que sur son propre quartier.", 403
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        if action == "request_adjacent":
            return True, "Accès autorisé", 200
        if action in ["organize_transit", "lower_retention"]:
            if user_role in ["LC", "CD"]:
                return True, "Accès autorisé", 200
            return False, "Accès refusé.", 403
        return False, "Action non permise au niveau 5.", 403

    return False, "Niveau de catastrophe invalide.", 400