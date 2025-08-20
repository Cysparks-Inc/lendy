-- Fix role values to match code expectations
UPDATE user_branch_roles SET role = 'super_admin' WHERE role = 'Super Admin';
UPDATE user_branch_roles SET role = 'branch_admin' WHERE role = 'Branch Admin';
UPDATE user_branch_roles SET role = 'loan_officer' WHERE role = 'Loan Officer';
UPDATE user_branch_roles SET role = 'teller' WHERE role = 'Teller';

-- Add more sample data for testing
INSERT INTO user_branch_roles (user_id, branch_id, role) VALUES
('9d51f548-9273-4d74-aad8-c3cef1b2f0ab', 1, 'branch_admin');

-- Create or update profiles for all users
INSERT INTO profiles (id, full_name, email, phone_number) VALUES
('47015b39-1afa-460c-857f-a7c0e1c5e74f', 'Samuel Mogul', 'sam.waweru2401@gmail.com', '+254712345678'),
('9d51f548-9273-4d74-aad8-c3cef1b2f0ab', 'Admin User', 'sam.waweru240@gmail.com', '+254712345679')
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone_number = EXCLUDED.phone_number;