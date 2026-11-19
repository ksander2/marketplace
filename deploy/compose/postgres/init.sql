CREATE USER auth WITH PASSWORD 'auth';
CREATE DATABASE auth OWNER auth;

CREATE USER catalog WITH PASSWORD 'catalog';
CREATE DATABASE catalog OWNER catalog;

CREATE USER orders WITH PASSWORD 'orders';
CREATE DATABASE orders OWNER orders;

CREATE USER notifications WITH PASSWORD 'notifications';
CREATE DATABASE notifications OWNER notifications;
