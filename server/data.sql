CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password VARCHAR(100) NOT NULL
);

CREATE TABLE events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  location VARCHAR(100) NOT NULL
);

CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT,
  user_id INT ,
  photo_url VARCHAR(255),
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
