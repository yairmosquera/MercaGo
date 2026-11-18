
USE MercaGo;
GO

IF OBJECT_ID('dbo.UsuariosMercaGo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UsuariosMercaGo (
        IdUsuario INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Nombre NVARCHAR(150) NOT NULL,
        Correo NVARCHAR(255) NOT NULL UNIQUE,
        ContrasenaHash VARCHAR(255) NOT NULL,
        Rol VARCHAR(20) NOT NULL
            CONSTRAINT CK_UsuariosMercaGo_Rol
            CHECK (Rol IN ('CLIENTE', 'ADMINISTRADOR')),
        Activo BIT NOT NULL
            CONSTRAINT DF_UsuariosMercaGo_Activo DEFAULT (1),
        FechaCreacion DATETIME2 NOT NULL
            CONSTRAINT DF_UsuariosMercaGo_Fecha
            DEFAULT SYSUTCDATETIME()
    );
END;
GO
